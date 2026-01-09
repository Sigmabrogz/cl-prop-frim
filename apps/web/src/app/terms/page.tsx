export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">
            Last updated: January 2025
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing and using PropFirm&apos;s services, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">2. Eligibility</h2>
            <p>
              You must be at least 18 years old to use our services. By using PropFirm, you represent 
              that you meet this age requirement and have the legal capacity to enter into this agreement.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">3. Account Registration</h2>
            <p>
              To access our trading services, you must create an account with accurate and complete information. 
              You are responsible for maintaining the confidentiality of your account credentials.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">4. Trading Rules</h2>
            <p>
              All traders must adhere to our trading rules, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Daily loss limits</li>
              <li>Maximum drawdown limits</li>
              <li>Minimum trading days requirements</li>
              <li>Prohibited trading strategies (as outlined in our rules)</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">5. Profit Sharing</h2>
            <p>
              Funded traders are entitled to a profit split as specified in their evaluation plan. 
              Payouts are processed according to our payout schedule and policies.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">6. Risk Disclosure</h2>
            <p>
              Trading cryptocurrency involves substantial risk of loss. Past performance does not 
              guarantee future results. You should only trade with capital you can afford to lose.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">7. Termination</h2>
            <p>
              We reserve the right to suspend or terminate accounts that violate our terms, 
              engage in fraudulent activity, or breach our trading rules.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">8. Contact</h2>
            <p>
              For questions about these terms, please contact us at support@propfirm.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

