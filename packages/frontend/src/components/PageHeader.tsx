import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: React.ReactNode;
  right?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, right }) => (
  <div className={styles.header}>
    <h2 className={styles.title}>{title}</h2>
    {right && <div className={styles.right}>{right}</div>}
  </div>
);

export default PageHeader;
