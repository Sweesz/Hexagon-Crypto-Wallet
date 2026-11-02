import React from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  variant?: 'text' | 'rectangular' | 'card' | 'circle';
  dataTestId?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  borderRadius,
  variant = 'text',
  dataTestId = 'skeleton-loader',
}) => {
  const style: React.CSSProperties = {
    width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
    borderRadius: borderRadius !== undefined ? (typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius) : undefined,
  };

  return (
    <div
      className={`skeleton-base skeleton-${variant} ${className}`}
      style={style}
      data-testid={dataTestId}
      aria-hidden="true"
    />
  );
};

export const BalanceSkeleton: React.FC<{ dataTestId?: string }> = ({ dataTestId = 'balance-skeleton' }) => {
  return (
    <div className="skeleton-balance-wrapper" data-testid={dataTestId} aria-label="Loading balance...">
      <div className="skeleton-balance-row">
        <Skeleton variant="text" width="60px" height="18px" />
        <Skeleton variant="rectangular" width="140px" height="28px" borderRadius="6px" />
      </div>
    </div>
  );
};

export const TransactionSkeleton: React.FC<{ dataTestId?: string }> = ({ dataTestId = 'transaction-skeleton' }) => {
  return (
    <div className="skeleton-transaction-wrapper" data-testid={dataTestId} aria-label="Preparing transaction...">
      <div className="skeleton-transaction-row">
        <Skeleton variant="text" width="100px" height="16px" />
        <Skeleton variant="rectangular" width="180px" height="20px" borderRadius="4px" />
      </div>
      <div className="skeleton-transaction-row">
        <Skeleton variant="text" width="70px" height="16px" />
        <Skeleton variant="rectangular" width="100px" height="24px" borderRadius="4px" />
      </div>
      <div className="skeleton-transaction-row">
        <Skeleton variant="text" width="80px" height="16px" />
        <Skeleton variant="rectangular" width="90px" height="18px" borderRadius="4px" />
      </div>
    </div>
  );
};

export default Skeleton;
