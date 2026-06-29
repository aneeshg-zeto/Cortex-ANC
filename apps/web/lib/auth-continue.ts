/** True when the user should stay on /auth/continue (company + role setup). */
export function shouldStayOnAuthContinue(redirectTo: string): boolean {
  return redirectTo === '/auth/continue' || redirectTo.startsWith('/auth/continue?');
}
