import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'inventoryapp',
  webDir: 'www',

  plugins: {
    Keyboard: {
      resize: 'body',       // Toto zabezpečí, že sa stránka scvrkne, keď vybehne klávesnica
      style: 'DARK',        // (Voliteľné) Tmavá téma klávesnice
      resizeOnFullScreen: true,
    },
  },
};

export default config;