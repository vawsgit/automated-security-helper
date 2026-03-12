import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const isProduction = process.env.DOCUSAURUS_ENV === 'production';

const config: Config = {
  title: 'ASH Workbench',
  tagline: 'Automated Security Helper Workbench',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://github.com',
  baseUrl: '/',

  organizationName: 'awslabs',
  projectName: 'automated-security-helper',

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  customFields: {
    isProduction,
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/awslabs/automated-security-helper/tree/main/workbench/docs/',
          ...(isProduction ? {exclude: ['working/**']} : {}),
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'ASH Workbench',
      logo: {
        alt: 'ASH Workbench Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'userDocsSidebar',
          position: 'left',
          label: 'User Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'developerDocsSidebar',
          position: 'left',
          label: 'Developer Docs',
        },
        ...(isProduction ? [] : [{
          type: 'docSidebar' as const,
          sidebarId: 'workingSidebar',
          position: 'left' as const,
          label: 'Working',
        }]),
        {
          href: 'https://github.com/awslabs/automated-security-helper',
          label: 'GitHub',
          position: 'right' as const,
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'User Docs', to: '/docs/user-docs/'},
            {label: 'Developer Docs', to: '/docs/developer-docs/'},
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/awslabs/automated-security-helper',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ASH Workbench. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
