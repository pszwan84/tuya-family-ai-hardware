import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '../components/Nav';
import { QueryProvider } from '../components/QueryProvider';

export const metadata: Metadata = {
  title: '家事 · 三代家庭日常',
  description: '把家人的日常，整理成彼此看得懂的小事件',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <QueryProvider>
          <Nav />
          <main className="app-main">{children}</main>
          <footer className="app-footer">
            <span>AI 生成内容均带标注，原始素材仅本人可见。</span>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}