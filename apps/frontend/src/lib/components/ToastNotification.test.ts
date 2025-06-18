import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ToastNotification from './ToastNotification.svelte';

describe('ToastNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with required props', () => {
    render(ToastNotification, { message: 'Test message' });
    
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders with title and message', () => {
    render(ToastNotification, { 
      title: 'Test Title',
      message: 'Test message' 
    });
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders success type with correct icon', () => {
    render(ToastNotification, { 
      type: 'success',
      message: 'Success message' 
    });
    
    expect(screen.getByText('✅')).toBeInTheDocument();
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('renders error type with correct icon', () => {
    render(ToastNotification, { 
      type: 'error',
      message: 'Error message' 
    });
    
    expect(screen.getByText('❌')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('renders warning type with correct icon', () => {
    render(ToastNotification, { 
      type: 'warning',
      message: 'Warning message' 
    });
    
    expect(screen.getByText('⚠️')).toBeInTheDocument();
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('renders info type with correct icon', () => {
    render(ToastNotification, { 
      type: 'info',
      message: 'Info message' 
    });
    
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('shows close button when dismissible', () => {
    render(ToastNotification, { 
      message: 'Test message',
      dismissible: true 
    });
    
    const closeButton = screen.getByLabelText('Dismiss notification');
    expect(closeButton).toBeInTheDocument();
  });

  it('hides close button when not dismissible', () => {
    render(ToastNotification, { 
      message: 'Test message',
      dismissible: false 
    });
    
    expect(screen.queryByLabelText('Dismiss notification')).not.toBeInTheDocument();
  });

  it('hides icon when showIcon is false', () => {
    render(ToastNotification, { 
      type: 'success',
      message: 'Test message',
      showIcon: false 
    });
    
    expect(screen.queryByText('✅')).not.toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('shows progress bar when not persistent and has duration', () => {
    render(ToastNotification, { 
      message: 'Test message',
      duration: 5000,
      persistent: false 
    });
    
    const progressBar = document.querySelector('.toast-progress-bar');
    expect(progressBar).toBeInTheDocument();
  });

  it('hides progress bar when persistent', () => {
    render(ToastNotification, { 
      message: 'Test message',
      persistent: true 
    });
    
    const progressBar = document.querySelector('.toast-progress-bar');
    expect(progressBar).not.toBeInTheDocument();
  });

  it('dismisses when close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const mockDismiss = vi.fn();
    
    const { component } = render(ToastNotification, { 
      message: 'Test message',
      dismissible: true 
    });
    
    component.$on('dismiss', mockDismiss);
    
    const closeButton = screen.getByLabelText('Dismiss notification');
    await user.click(closeButton);
    
    // Wait for animation
    vi.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(mockDismiss).toHaveBeenCalled();
    });
  });

  it('auto-dismisses after duration when not persistent', async () => {
    const mockDismiss = vi.fn();
    
    const { component } = render(ToastNotification, { 
      message: 'Test message',
      duration: 1000,
      persistent: false 
    });
    
    component.$on('dismiss', mockDismiss);
    
    // Fast-forward time
    vi.advanceTimersByTime(1000);
    
    // Wait for animation
    vi.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(mockDismiss).toHaveBeenCalled();
    });
  });

  it('does not auto-dismiss when persistent', async () => {
    const mockDismiss = vi.fn();
    
    const { component } = render(ToastNotification, { 
      message: 'Test message',
      duration: 1000,
      persistent: true 
    });
    
    component.$on('dismiss', mockDismiss);
    
    // Fast-forward time
    vi.advanceTimersByTime(2000);
    
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(ToastNotification, { message: 'Test message' });
    
    const toast = screen.getByRole('alert');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('applies correct CSS classes for type', () => {
    render(ToastNotification, { 
      type: 'success',
      message: 'Test message' 
    });
    
    const toast = screen.getByRole('alert');
    expect(toast).toHaveClass('toast-success');
  });

  it('renders with custom duration', () => {
    render(ToastNotification, { 
      message: 'Test message',
      duration: 10000 
    });
    
    const progressBar = document.querySelector('.toast-progress-bar');
    expect(progressBar).toHaveStyle('animation-duration: 10000ms');
  });
}); 