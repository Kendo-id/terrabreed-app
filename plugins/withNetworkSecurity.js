const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNetworkSecurity = (config) => {
  config = withAndroidManifest(config, async (config) => {
    const app = config.modResults.manifest.application[0];
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res', 'xml'
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');
      fs.writeFileSync(xmlPath, [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<network-security-config>',
        '  <!-- Allow self-signed cert for local server kendo-assistant.com -->',
        '  <domain-config cleartextTrafficPermitted="false">',
        '    <domain includeSubdomains="true">kendo-assistant.com</domain>',
        '    <trust-anchors>',
        '      <certificates src="system"/>',
        '      <certificates src="user"/>',
        '    </trust-anchors>',
        '  </domain-config>',
        '  <base-config cleartextTrafficPermitted="false">',
        '    <trust-anchors>',
        '      <certificates src="system"/>',
        '    </trust-anchors>',
        '  </base-config>',
        '</network-security-config>',
      ].join('\n'));
      return config;
    },
  ]);

  return config;
};

module.exports = withNetworkSecurity;
