import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  lines = 1,
}) => {
  const baseClasses = 'animate-pulse bg-gray-200';
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-md';
      default:
        return 'rounded';
    }
  };

  const getDefaultSize = () => {
    switch (variant) {
      case 'circular':
        return { width: '2.5rem', height: '2.5rem' };
      case 'rectangular':
        return { width: '100%', height: '1rem' };
      default:
        return { width: '100%', height: '1rem' };
    }
  };

  const defaultSize = getDefaultSize();
  const style = {
    width: width || defaultSize.width,
    height: height || defaultSize.height,
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={className}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${getVariantClasses()} ${
              index < lines - 1 ? 'mb-2' : ''
            }`}
            style={{
              ...style,
              width: index === lines - 1 ? '70%' : style.width,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${getVariantClasses()} ${className}`}
      style={style}
    />
  );
};

export default SkeletonLoader;