import { useRef, useEffect } from 'react'

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
)

const LEGAL_CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'January 2026',
    sections: [
      {
        heading: '1. Introduction',
        body: 'VerifEye ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our deepfake detection and media authentication platform. By using VerifEye, you agree to the practices described in this policy.',
      },
      {
        heading: '2. Information We Collect',
        body: 'We collect information you provide directly, including account registration details (email address, password), media files you submit for analysis, and scan results. We also collect technical data such as device information and usage patterns. Media files are processed solely for deepfake detection analysis and are not stored permanently unless you choose to save scan history locally.',
      },
      {
        heading: '3. How We Use Your Information',
        body: 'We use your information to provide, maintain, and improve our deepfake detection services; to authenticate media authenticity; to process your scans and generate forensic reports; to communicate with you about your account; and to comply with legal obligations. We do not sell your personal data to third parties.',
      },
      {
        heading: '4. Data Protection',
        body: 'We implement industry-standard security measures to protect your data, including encryption of sensitive information and secure storage practices. Your media files are processed in a secure environment. We retain account and scan history data only as necessary to provide our services.',
      },
      {
        heading: '5. Your Rights',
        body: 'You have the right to access, correct, or delete your personal data. You may export your scan history at any time. You may also request account deletion, which will permanently remove your data from our systems.',
      },
      {
        heading: '6. Contact',
        body: 'For privacy-related inquiries, contact us at support@verifeye.ai.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: 'January 2026',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By accessing or using VerifEye, you agree to be bound by these Terms of Service. VerifEye provides a platform for deepfake detection and media authentication. Use of our services constitutes acceptance of these terms.',
      },
      {
        heading: '2. Description of Service',
        body: 'VerifEye analyzes uploaded media (videos, images, audio) to assess the likelihood of AI-generated or manipulated content. Our analysis includes biometric integrity checks, vocalic imprint verification, and metadata examination. Results are provided for informational purposes and do not constitute legal or forensic certification.',
      },
      {
        heading: '3. User Responsibilities',
        body: 'You agree to use VerifEye only for lawful purposes. You may not submit content you do not have the right to analyze, or use the service to harass, defame, or violate others\' rights. You are responsible for maintaining the confidentiality of your account credentials.',
      },
      {
        heading: '4. Limitation of Liability',
        body: 'VerifEye and its analysis are provided "as is." We do not warrant that our deepfake detection is infallible. We are not liable for decisions made based on our analysis. Our liability is limited to the extent permitted by applicable law.',
      },
      {
        heading: '5. Intellectual Property',
        body: 'All intellectual property in the VerifEye platform, including technology, branding, and content, remains the property of VerifEye. You may not copy, modify, or distribute our materials without permission.',
      },
      {
        heading: '6. Contact',
        body: 'For questions about these terms, contact us at support@verifeye.ai.',
      },
    ],
  },
}

export default function LegalPage({ type, onBack }) {
  const content = LEGAL_CONTENT[type]
  const containerRef = useRef(null)

  useEffect(() => {
    containerRef.current?.scrollTo(0, 0)
  }, [type])

  if (!content) return null

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-slate-800 shrink-0">
        <button
          onClick={onBack}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h1 className="text-xl font-bold text-white">{content.title}</h1>
      </header>
      <main ref={containerRef} className="flex-1 overflow-y-auto px-4 py-6 pb-12">
        <div className="max-w-2xl mx-auto">
          <p className="text-slate-500 text-sm mb-8">Last updated: {content.updated}</p>
          <div className="space-y-8">
            {content.sections.map((section, i) => (
              <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
                <h2 className="text-cyan-400 font-semibold mb-3">{section.heading}</h2>
                <p className="text-slate-300 text-sm leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
