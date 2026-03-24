import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  get_dashboard_overview: 'Overview Stats',
  get_overallocated_resources: 'Over-allocated Resources',
  get_utilization_by_skill: 'Skill Utilization',
  get_project_demand_analysis: 'Project Demand Analysis',
  get_vendor_performance: 'Vendor Performance',
  get_resources_by_criteria: 'Resource Search',
  get_weekly_trend: 'Weekly Trends',
}

const SUGGESTED_PROMPTS = [
  'Who is over-allocated this week?',
  'Which skills have the biggest demand gap?',
  'Show me project demand vs capacity',
  'How is each vendor performing?',
  'Which projects are at delivery risk?',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function formatToolName(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ')
}

/**
 * Very lightweight markdown-like renderer:
 * - **bold**
 * - Newlines → <br>
 * - Lines starting with "- " or "• " → bullet list items
 */
function renderAssistantContent(text: string): JSX.Element {
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Render bold segments within a line
    const renderLine = (raw: string): JSX.Element[] => {
      const parts = raw.split(/(\*\*[^*]+\*\*)/)
      return parts.map((part, pi) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pi}>{part.slice(2, -2)}</strong>
        }
        return <span key={pi}>{part}</span>
      })
    }

    // Heading lines (### or ##)
    if (/^#{1,3}\s/.test(line)) {
      const content = line.replace(/^#{1,3}\s/, '')
      elements.push(
        <p key={key++} className="font-semibold text-gray-800 mt-2 mb-0.5">
          {renderLine(content)}
        </p>
      )
    // Bullet lines
    } else if (/^[-•*]\s/.test(line)) {
      elements.push(
        <div key={key++} className="flex gap-1.5 leading-snug">
          <span className="text-teal-500 mt-0.5 flex-shrink-0">•</span>
          <span>{renderLine(line.replace(/^[-•*]\s/, ''))}</span>
        </div>
      )
    // Numbered list
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/)
      if (match) {
        elements.push(
          <div key={key++} className="flex gap-1.5 leading-snug">
            <span className="text-teal-600 flex-shrink-0 font-medium">{match[1]}.</span>
            <span>{renderLine(match[2])}</span>
          </div>
        )
      }
    // Empty line → spacing
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1.5" />)
    } else {
      elements.push(
        <p key={key++} className="leading-snug">
          {renderLine(line)}
        </p>
      )
    }
  }

  return <div className="space-y-0.5 text-sm">{elements}</div>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<string[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTools])

  // ── Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  // ── Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // ── Send message
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      const userMsg: Message = { id: generateId(), role: 'user', content: trimmed }
      setMessages(prev => [...prev, userMsg])
      setInput('')
      setIsStreaming(true)
      setActiveTools([])

      // Build conversation history (include previous messages)
      const history = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: trimmed },
      ]

      // Placeholder assistant message
      const assistantId = generateId()
      setMessages(prev => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', toolCalls: [] },
      ])

      abortRef.current = new AbortController()

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            try {
              const event = JSON.parse(jsonStr)

              if (event.type === 'tool_call') {
                const toolLabel = formatToolName(event.tool)
                setActiveTools(prev =>
                  prev.includes(toolLabel) ? prev : [...prev, toolLabel]
                )
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId
                      ? {
                          ...m,
                          toolCalls: m.toolCalls?.includes(toolLabel)
                            ? m.toolCalls
                            : [...(m.toolCalls ?? []), toolLabel],
                        }
                      : m
                  )
                )
              } else if (event.type === 'text') {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                )
              } else if (event.type === 'done') {
                setIsStreaming(false)
                setActiveTools([])
              } else if (event.type === 'error') {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content:
                            m.content ||
                            `Error: ${event.message ?? 'Something went wrong.'}`,
                        }
                      : m
                  )
                )
                setIsStreaming(false)
                setActiveTools([])
              }
            } catch {
              // Ignore malformed JSON lines
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    m.content ||
                    'Failed to connect to the AI service. Please try again.',
                }
              : m
          )
        )
        setIsStreaming(false)
        setActiveTools([])
      }
    },
    [isStreaming, messages]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating button ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Capacity Analyst"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
          style={{ animation: 'aiChatPulse 3s ease-in-out infinite' }}
        >
          {/* Brain / sparkle icon */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14Z" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14Z" />
          </svg>
        </button>
      )}

      {/* ── Chat panel ── */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-xl shadow-2xl overflow-hidden"
          style={{ width: '420px', height: '600px', fontFamily: 'inherit' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14Z" />
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">AI Capacity Analyst</p>
                <p className="text-xs text-slate-400 leading-tight">Powered by Claude</p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOpen(false)
                abortRef.current?.abort()
              }}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
              aria-label="Close chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 space-y-4">
            {messages.length === 0 && !isStreaming ? (
              /* Empty state with suggestions */
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-3">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14Z" />
                      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Ask me anything about your resources</p>
                  <p className="text-xs text-gray-500 mt-1">I have live access to all capacity planning data</p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {SUGGESTED_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-left text-xs px-3 py-2.5 rounded-lg bg-white border border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-gray-700 hover:text-teal-800 transition-all duration-150 shadow-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message list */
              <>
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14Z" />
                          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14Z" />
                        </svg>
                      </div>
                    )}
                    <div className={`max-w-[85%] ${msg.role === 'user' ? '' : 'flex-1'}`}>
                      {/* Tool call pills */}
                      {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.toolCalls.map(tool => (
                            <span
                              key={tool}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              </svg>
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Message bubble */}
                      {msg.role === 'user' ? (
                        <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-teal-600 text-white text-sm leading-snug">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-white border border-gray-200 text-gray-800 shadow-sm">
                          {msg.content ? (
                            renderAssistantContent(msg.content)
                          ) : isStreaming ? (
                            <span className="text-sm text-gray-400 italic">Claude is thinking...</span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">No response</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Active tool indicator (during streaming) */}
                {isStreaming && activeTools.length > 0 && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 mr-2 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1.5">
                      {activeTools.slice(-2).map(tool => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0"
                            style={{ animation: 'aiChatBlink 1s ease-in-out infinite' }}
                          />
                          Querying: {tool}...
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thinking indicator (before any tools called) */}
                {isStreaming && activeTools.length === 0 && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 mr-2 flex-shrink-0" />
                    <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-white border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 italic">Claude is thinking</span>
                        <div className="flex gap-0.5">
                          {[0, 1, 2].map(i => (
                            <span
                              key={i}
                              className="w-1 h-1 rounded-full bg-gray-400"
                              style={{ animation: `aiChatBlink 1.2s ease-in-out ${i * 0.2}s infinite` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-3">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about resources, capacity, or projects..."
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
                style={{ maxHeight: '120px', overflowY: 'auto' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                }}
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
                aria-label="Send message"
              >
                {isStreaming ? (
                  <svg
                    width="16" height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-2">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes aiChatPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(13, 148, 136, 0); }
        }
        @keyframes aiChatBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
