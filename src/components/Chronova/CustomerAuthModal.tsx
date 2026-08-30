'use client'

import React, { useState } from 'react'

export interface CustomerUser {
  name: string
  email: string
  phone: string
  isLoggedIn: boolean
  tier?: string
  memberSince?: string
}

interface CustomerAuthModalProps {
  isOpen: boolean
  onClose: () => void
  user: CustomerUser
  onLogin: (user: CustomerUser) => void
  onLogout: () => void
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogin,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'profile'>(
    user.isLoggedIn ? 'profile' : 'signin'
  )

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [signInError, setSignInError] = useState<string | null>(null)

  // Sign Up Form State
  const [signUpName, setSignUpName] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPhone, setSignUpPhone] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [signUpError, setSignUpError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!signInEmail || !signInPassword) {
      setSignInError('Please enter both your email/phone and password.')
      return
    }
    const namePart = signInEmail.split('@')[0]
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1)
    onLogin({
      name: formattedName || 'Lokeshwar Sudam',
      email: signInEmail.includes('@') ? signInEmail : `${signInEmail}@chronova.in`,
      phone: '+91 98765 43210',
      isLoggedIn: true,
      tier: 'CHRONOVA Gold Member',
      memberSince: 'August 2026',
    })
    setSignInError(null)
    onClose()
  }

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!signUpName || !signUpEmail || !signUpPhone || !signUpPassword) {
      setSignUpError('All fields are required to create a certified account.')
      return
    }
    if (!agreeTerms) {
      setSignUpError('Please accept the Terms of Service & Warranty Protection.')
      return
    }

    setSignUpError(null)
    setSignUpSuccess(true)
    setTimeout(() => {
      onLogin({
        name: signUpName,
        email: signUpEmail,
        phone: signUpPhone.startsWith('+91') ? signUpPhone : `+91 ${signUpPhone}`,
        isLoggedIn: true,
        tier: 'CHRONOVA VIP Member (New)',
        memberSince: 'August 2026',
      })
      setSignUpSuccess(false)
      onClose()
    }, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-sm transition cursor-pointer"
          title="Close"
        >
          ✕
        </button>

        {user.isLoggedIn ? (
          /* Profile & Account Dashboard */
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                {user.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{user.name}</h3>
                <p className="text-xs text-slate-500">{user.email}</p>
                <span className="inline-block mt-1 text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  ★ {user.tier || 'CHRONOVA Gold Member'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>📦 Registered Phone:</span>
                  <span className="font-mono">{user.phone}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Member since {user.memberSince || 'August 2026'} · Verified Customer
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                <div className="font-bold">✓ 100% Genuine Brand Warranty Active</div>
                <p className="text-[11px] leading-relaxed">
                  All timepieces registered to this profile enjoy pan-India authorized doorstep service coverage.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onLogout()
                setActiveTab('signin')
              }}
              className="w-full py-3 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition border border-slate-200 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        ) : (
          /* Sign In & Sign Up Views */
          <div>
            {/* Header Tabs */}
            <div className="flex border-b border-slate-200 mb-6">
              <button
                onClick={() => {
                  setActiveTab('signin')
                  setSignInError(null)
                  setSignUpError(null)
                }}
                className={`flex-1 pb-3 text-xs font-extrabold uppercase tracking-wider transition border-b-2 cursor-pointer ${
                  activeTab === 'signin'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setActiveTab('signup')
                  setSignInError(null)
                  setSignUpError(null)
                }}
                className={`flex-1 pb-3 text-xs font-extrabold uppercase tracking-wider transition border-b-2 cursor-pointer ${
                  activeTab === 'signup'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Create Account (Sign Up)
              </button>
            </div>

            {activeTab === 'signin' ? (
              /* SIGN IN FORM */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email or Mobile Number</label>
                  <input
                    type="text"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="name@example.com / 9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Password reset link sent to your registered email.') }} className="text-[11px] font-semibold text-blue-700 hover:underline">
                      Forgot?
                    </a>
                  </div>
                  <input
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                {signInError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {signInError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider transition shadow-md cursor-pointer active:scale-98"
                >
                  SIGN IN TO CHRONOVA
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onLogin({
                        name: 'Lokeshwar Sudam',
                        email: 'lokeshwar@chronova.in',
                        phone: '+91 98765 43210',
                        isLoggedIn: true,
                        tier: 'CHRONOVA Gold Member',
                        memberSince: 'August 2026',
                      })
                      onClose()
                    }}
                    className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    Quick One-Click Demo Login (Lokeshwar)
                  </button>
                </div>
              </form>
            ) : (
              /* SIGN UP FORM */
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="e.g. Lokeshwar Sudam"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Mobile Number (+91)</label>
                  <input
                    type="tel"
                    required
                    value={signUpPhone}
                    onChange={(e) => setSignUpPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Create Password</label>
                  <input
                    type="password"
                    required
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-600 leading-tight">
                    I agree to CHRONOVA Terms, Official Warranty Card Registration & Privacy Policy.
                  </span>
                </label>

                {signUpError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {signUpError}
                  </p>
                )}

                {signUpSuccess && (
                  <p className="text-xs text-emerald-700 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    ✓ Account created successfully! Logging you in...
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider transition shadow-md cursor-pointer active:scale-98"
                >
                  CREATE CHRONOVA ACCOUNT
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
