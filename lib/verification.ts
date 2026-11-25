export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export function normalizeVerificationStatus(
  status: string | null | undefined,
  verified?: boolean | null
): VerificationStatus {
  if (status === 'approved' || (status == null && Boolean(verified))) {
    return 'approved'
  }
  if (status === 'rejected') {
    return 'rejected'
  }
  return 'pending'
}
