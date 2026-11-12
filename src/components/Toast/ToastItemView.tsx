import React from 'react';
import type { ToastItem } from './ToastContext';
import { Toast } from './Toast';

interface ToastItemViewProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const ToastItemView: React.FC<ToastItemViewProps> = ({ toast, onDismiss }) => {
  return (
    <Toast
      id={toast.id}
      type={toast.type}
      title={toast.title}
      message={toast.message}
      technicalDetails={toast.technicalDetails}
      duration={toast.duration}
      onDismiss={() => onDismiss(toast.id)}
    />
  );
};
