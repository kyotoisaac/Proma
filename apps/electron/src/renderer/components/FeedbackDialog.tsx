import * as React from 'react'
import { createPortal } from 'react-dom'
import { MessageSquareText, Send, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const QUICKFORM_URL = 'https://quickform.cn/api/3p2ddfvpxe'

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps): React.ReactElement | null {
  const [feedback, setFeedback] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setFeedback('')
      setSent(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!feedback.trim()) return
    setSending(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const response = await fetch(QUICKFORM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedback.trim(),
          timestamp: new Date().toISOString(),
          source: '培立智云桌面Agent',
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (response.ok) {
        setSent(true)
        toast.success('反馈已提交，感谢！')
        setTimeout(() => onOpenChange(false), 1500)
      } else {
        toast.error('提交失败，请稍后重试')
      }
    } catch {
      toast.error('网络错误，请稍后重试')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!open) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] bg-black/20" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-[420px] max-w-[90vw] rounded-xl bg-background shadow-2xl border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <MessageSquareText size={18} className="text-primary" />
            <span className="font-medium text-sm">使用反馈</span>
          </div>
          <div className="px-5 py-4">
            <textarea
              autoFocus
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请写下你的使用体验、遇到的问题或改进建议..."
              disabled={sent}
              rows={6}
              className={cn(
                'w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm',
                'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                'disabled:opacity-50',
              )}
            />
          </div>
          <div className="flex items-center justify-between px-5 pb-4">
            <span className="text-xs text-muted-foreground/50">
              {sending ? '发送中...' : sent ? '已提交 ✅' : 'Ctrl+Enter 发送'}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!feedback.trim() || sending || sent}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                sent
                  ? 'bg-emerald-500/10 text-emerald-600 cursor-default'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : sent ? <Check size={14} /> : <Send size={14} />}
              {sending ? '发送中' : sent ? '已提交' : '提交反馈'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
