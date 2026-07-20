import {defineJspsychConfig} from '@jspsych/docusaurus-preset';

/**
 * Standalone documentation site for the jsPsych metadata tools
 * (@jspsych/metadata, the metadata CLI, and the web wizard).
 *
 * Shared branding, search, navbar, footer, and the ecosystem switcher come
 * from the jsPsych docs theme/preset; only site-specific details live here.
 */
export default defineJspsychConfig({
  title: 'jsPsych Metadata',
  tagline: 'Generate Psych-DS compliant metadata for jsPsych experiments',
  url: 'https://metadata.jspsych.org',
  baseUrl: '/',
  organizationName: 'jspsych',
  projectName: 'metadata',
  githubUrl: 'https://github.com/jspsych/metadata',

  // Loaded after the shared jsPsych brand CSS so it can override theme tokens.
  customCss: './src/css/custom.css',

  navbar: {
    title: 'jsPsych Metadata',
    items: [
      {to: '/wizard', label: 'Wizard', position: 'left'},
      {type: 'doc', docId: 'introduction', position: 'left', label: 'What is Psych-DS?'},
      {type: 'docSidebar', sidebarId: 'guides', position: 'left', label: 'Guides'},
      {
        type: 'doc',
        docId: 'reference/cli-reference',
        position: 'left',
        label: 'Reference',
      },
    ],
  },

  docs: {
    sidebarPath: './sidebars.ts',
    breadcrumbs: false,
  },

  // Let readers collapse the (only) sidebar — the CLI tab — to reclaim space.
  themeConfig: {
    docs: {
      sidebar: {hideable: true},
    },
  },

  // The footer UI is a custom single-row layout (see src/theme/Footer). This
  // still needs to exist so Docusaurus mounts the footer slot; its contents are
  // rendered by the swizzled component, not from here.
  footer: {style: 'dark', links: []},
});
