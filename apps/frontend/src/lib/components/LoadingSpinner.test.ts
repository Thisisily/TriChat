import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LoadingSpinner from './LoadingSpinner.svelte';

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(LoadingSpinner);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
    
    const srText = screen.getByText('Loading...');
    expect(srText).toBeInTheDocument();
    expect(srText).toHaveClass('sr-only');
  });

  it('renders with small size', () => {
    render(LoadingSpinner, { size: 'small' });
    
    const spinner = screen.getByRole('status').firstElementChild;
    expect(spinner).toHaveClass('w-4', 'h-4');
  });

  it('renders with medium size', () => {
    render(LoadingSpinner, { size: 'medium' });
    
    const spinner = screen.getByRole('status').firstElementChild;
    expect(spinner).toHaveClass('w-6', 'h-6');
  });

  it('renders with large size', () => {
    render(LoadingSpinner, { size: 'large' });
    
    const spinner = screen.getByRole('status').firstElementChild;
    expect(spinner).toHaveClass('w-8', 'h-8');
  });

  it('renders with primary variant', () => {
    render(LoadingSpinner, { variant: 'primary' });
    
    const spinner = screen.getByRole('status').firstElementChild;
    expect(spinner).toHaveClass('spinner-primary');
  });

  it('renders with secondary variant', () => {
    render(LoadingSpinner, { variant: 'secondary' });
    
    const spinner = screen.getByRole('status').firstElementChild;
    expect(spinner).toHaveClass('spinner-secondary');
  });

  it('renders with glass variant', () => {
    render(LoadingSpinner, { variant: 'glass' });
    
    const spinner = screen.getByRole('status').firstElementChild;
    expect(spinner).toHaveClass('spinner-glass');
  });

  it('applies custom className', () => {
    render(LoadingSpinner, { className: 'custom-class' });
    
    const container = screen.getByRole('status').parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('has proper accessibility attributes', () => {
    render(LoadingSpinner);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
    expect(spinner).toHaveAttribute('role', 'status');
  });

  it('has animation styles applied', () => {
    render(LoadingSpinner);
    
    const spinner = screen.getByRole('status').firstElementChild;
    expect(spinner).toHaveClass('spinner');
    
    // Check if animation is applied through computed styles
    const styles = window.getComputedStyle(spinner as Element);
    expect(styles).toBeDefined();
  });

  it('combines size and variant classes correctly', () => {
    render(LoadingSpinner, { size: 'large', variant: 'glass' });
    
    const spinner = screen.getByRole('status').firstElementChild;
    expect(spinner).toHaveClass('spinner', 'spinner-glass', 'w-8', 'h-8');
  });
}); 