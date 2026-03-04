import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'MoodleGrab',
    description: 'Download all your Moodle course files in one click',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel', 'downloads'],
    action: {},
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      // Remove auto-generated host_permissions from runtime content script.
      // We use activeTab + scripting.executeScript for on-demand injection.
      manifest.host_permissions = [];
    },
  },
});
