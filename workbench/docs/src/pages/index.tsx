import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const allSections = [
  {
    title: 'User Docs',
    to: '/docs/user-docs/',
    description:
      'Learn how to use the ASH Workbench to scan and analyze your code for security issues.',
  },
  {
    title: 'Developer Docs',
    to: '/docs/developer-docs/',
    description:
      'Architecture, implementation guides, and reference for contributors.',
  },
  {
    title: 'Working',
    to: '/docs/working/',
    description:
      'Research notes, plans, and in-progress documentation.',
  },
];

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const isProduction = siteConfig.customFields?.isProduction as boolean;
  const sections = isProduction
    ? allSections.filter(s => s.title !== 'Working')
    : allSections;

  return (
    <Layout description="ASH Workbench documentation">
      <header className={styles.heroBanner}>
        <div className="container">
          <Heading as="h1">{siteConfig.title}</Heading>
          <p className={styles.subtitle}>{siteConfig.tagline}</p>
        </div>
      </header>
      <main className="container margin-vert--lg">
        <div className={clsx('row', styles.sections)}>
          {sections.map(({title, to, description}) => (
            <div key={title} className="col col--4">
              <div className={styles.card}>
                <Heading as="h3">
                  <Link to={to}>{title}</Link>
                </Heading>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
