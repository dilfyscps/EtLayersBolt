import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonTone = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  children: ReactNode;
}

export function Button({ tone = 'secondary', className = '', children, ...props }: ButtonProps) {
  const toneClass = tone === 'primary' ? 'etl-button--primary' : 'etl-button--secondary';

  return (
    <button
      className={`etl-button ${toneClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
