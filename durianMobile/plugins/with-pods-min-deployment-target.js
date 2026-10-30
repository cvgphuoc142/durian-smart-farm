// Recent Xcode rejects pods that still declare iOS 9–12 as their minimum (Google Sign-In,
// SDWebImage, their privacy bundles…). Raise every pod target below the app's floor to that floor.
const { withPodfile } = require('expo/config-plugins');

const MIN = '15.1';
const MARKER = '# with-pods-min-deployment-target';

module.exports = function withPodsMinDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults;
    if (podfile.contents.includes(MARKER)) return cfg;
    podfile.contents = podfile.contents.replace(
      /post_install do \|installer\|\n/,
      `post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${MIN}')
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN}'
        end
      end
    end
`,
    );
    return cfg;
  });
};
