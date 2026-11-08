
import { createHash, timingSafeEqual } from 'node:crypto'
import { connectDB } from '@/lib/mongodb'
import Session from '@/lib/models/Session'

export async function verifyTeacherAccess(
  request: Request,
  sessionCode: string,
): Promise<boolean> {
  // Find the private teacher cookie for this classroom.
  const cookieName = `pulsecheck_teacher_${sessionCode}`

  const cookieHeader = request.headers.get('cookie') ?? ''

  const matchingCookie = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`))

  if (!matchingCookie) {
    return false
  }

  // Extract the original private teacher key.
  const teacherKey = matchingCookie.slice(cookieName.length + 1)

  // The generated key must contain exactly 64 hexadecimal characters.
  if (!/^[a-f0-9]{64}$/i.test(teacherKey)) {
    return false
  }

  // Retrieve the saved hash from MongoDB.
  await connectDB()

  const session = await Session.findOne({ code: sessionCode })
    .select('+teacherKeyHash')
    .lean()

  const storedHash = session?.teacherKeyHash

  if (
    typeof storedHash !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(storedHash)
  ) {
    return false
  }

  // Hash the teacher key received from the browser.
  const providedHash = createHash('sha256')
    .update(teacherKey)
    .digest()

  const expectedHash = Buffer.from(storedHash, 'hex')

  // Compare hashes without leaking comparison timing information.
  return (
    providedHash.length === expectedHash.length &&
    timingSafeEqual(providedHash, expectedHash)
  )
}
