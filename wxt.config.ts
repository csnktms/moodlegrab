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
    // @ts-expect-error -- side_panel is valid for MV3 but not yet in WXT types
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
