'use client';

import { useEffect } from 'react';

import pkg from '../../package.json';

export default function BuildInfo() {
  useEffect(() => {
    const print = (key: string, value: string) =>
      console.log(
        `%c ${key} %c ${value} %c `,
        'background:#20232a ; padding: 1px; border-radius: 3px 0 0 3px;  color: #fff',
        'background:#61dafb ;padding: 1px; border-radius: 0 3px 3px 0;  color: #20232a; font-weight: bold;',
        'background:transparent',
      );
    print(pkg.name, pkg.version);
    print('build time', `${process.env.NEXT_PUBLIC_BUILD_TIME}`);
  }, []);
  return null;
}
