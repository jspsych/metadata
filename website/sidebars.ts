import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Only the multi-page CLI tab needs a sidebar. Single-page tabs (Introduction,
 * Reference) link straight to their page and render full-width with just a
 * table of contents; the wizard is the homepage, not a doc.
 */
const sidebars: SidebarsConfig = {
  guides: [
    'guides/using-the-wizard',
    'guides/using-the-cli',
    'guides/customizing-output',
  ],
};

export default sidebars;
