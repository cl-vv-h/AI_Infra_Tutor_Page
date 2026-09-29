export const siteFeatures = typeof __SITE_FEATURES__ === 'undefined'
  ? { scenarioLibrary: false, scenarioComparison: false } : __SITE_FEATURES__
export const calculatorVersion = typeof __CALCULATOR_FINGERPRINT__ === 'undefined'
  ? 'test-calculator' : __CALCULATOR_FINGERPRINT__
