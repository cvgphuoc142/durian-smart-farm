// Extends app.json. A production build without the real backend URL would ship an app that cannot
// sign in, so EAS stops the build here instead.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    const missing = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_PRIVACY_URL'].filter(
      (name) => !process.env[name],
    );
    if (missing.length) throw new Error(`Production build needs ${missing.join(', ')}.`);
  }
  return config;
};
