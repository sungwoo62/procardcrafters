'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertTriangle, Eye, MessageSquare } from 'lucide-react'

interface ProofData {
  id: string
  version: number
  status: 'pending' | 'approved' | 'revision_requested'
  admin_note: string | null
  customer_comment: string | null
  original_filename: string
  uploaded_at: string
  responded_at: string | null
  signed_url: string | null
}

export default function DesignProofReview({ orderNumber }: { orderNumber: string }) {
  const [proofs, setProofs] = useState<ProofData[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [comment, setComment] = useState('')
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const fetchProofs = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderNumber}/proof`)
    if (res.ok) {
      const data = await res.json()
      setProofs(data.proofs ?? [])
    }
    setLoading(false)
  }, [orderNumber])

  useEffect(() => {
    fetchProofs()
  }, [fetchProofs])

  async function handleRespond(proofId: string, action: 'approve' | 'revision_requested') {
    if (action === 'revision_requested' && !comment.trim()) {
      setMsg('Please enter your revision notes')
      return
    }
    setResponding(true)
    setMsg('')

    const res = await fetch(`/api/orders/${orderNumber}/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proofId,
        action,
        comment: comment.trim() || undefined,
      }),
    })

    if (res.ok) {
      setMsg(action === 'approve' ? 'Design proof approved. Production will begin shortly.' : 'Revision request submitted.')
      setComment('')
      setShowCommentFor(null)
      await fetchProofs()
    } else {
      const data = await res.json()
      setMsg(`Error: ${data.error}`)
    }
    setResponding(false)
  }

  if (loading || proofs.length === 0) return null

  const latestProof = proofs[0]

  return (
    <section id="proof" className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Design Proof Review</h2>

      {proofs.map((proof) => {
        const isLatest = proof.id === latestProof.id

        return (
          <div
            key={proof.id}
            className={`border rounded-xl overflow-hidden ${
              isLatest && proof.status === 'pending'
                ? 'border-blue-300 bg-blue-50/30'
                : 'border-gray-200'
            }`}
          >
            <div className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Version {proof.version}
                  </span>
                  {proof.status === 'pending' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                      Awaiting Your Review
                    </span>
                  )}
                  {proof.status === 'approved' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Approved
                    </span>
                  )}
                  {proof.status === 'revision_requested' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Revision Requested
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(proof.uploaded_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {/* Admin note */}
              {proof.admin_note && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
                  <span className="font-medium">Designer note:</span> {proof.admin_note}
                </div>
              )}

              {/* Preview */}
              {proof.signed_url && (
                <div className="relative">
                  {proof.original_filename.match(/\.(png|jpg|jpeg|tiff?)$/i) ? (
                    <img
                      src={proof.signed_url}
                      alt={`Design proof v${proof.version}`}
                      className="w-full rounded-lg border border-gray-200 max-h-[500px] object-contain bg-white"
                    />
                  ) : (
                    <a
                      href={proof.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-blue-600 hover:bg-gray-100 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                      <span className="text-sm font-medium">View Proof ({proof.original_filename})</span>
                    </a>
                  )}
                </div>
              )}

              {/* Customer comment (for revision_requested) */}
              {proof.status === 'revision_requested' && proof.customer_comment && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-800">
                  <span className="font-medium">Your feedback:</span> {proof.customer_comment}
                </div>
              )}

              {/* Action buttons (only for pending latest proof) */}
              {proof.status === 'pending' && isLatest && (
                <div className="space-y-3 pt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond(proof.id, 'approve')}
                      disabled={responding}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {responding ? 'Processing...' : 'Approve Design'}
                    </button>
                    <button
                      onClick={() => setShowCommentFor(showCommentFor === proof.id ? null : proof.id)}
                      disabled={responding}
                      className="flex-1 flex items-center justify-center gap-2 border border-orange-300 text-orange-700 py-2.5 rounded-lg font-medium text-sm hover:bg-orange-50 disabled:opacity-50 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Request Revision
                    </button>
                  </div>

                  {showCommentFor === proof.id && (
                    <div className="space-y-2">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Please describe the changes you'd like us to make..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleRespond(proof.id, 'revision_requested')}
                        disabled={responding || !comment.trim()}
                        className="w-full bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
                      >
                        {responding ? 'Submitting...' : 'Submit Revision Request'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {msg && (
        <p className={`text-sm text-center ${msg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
          {msg}
        </p>
      )}
    </section>
  )
}
