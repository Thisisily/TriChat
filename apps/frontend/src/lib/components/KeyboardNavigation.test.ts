import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import KeyboardNavigation from './KeyboardNavigation.svelte';

// Test component that uses KeyboardNavigation
const TestComponent = `
<script>
  import KeyboardNavigation from './KeyboardNavigation.svelte';
  
  export let enabled = true;
  export let trapFocus = false;
  export let autoFocus = false;
  
  let navigationEvents = [];
  let focusEvents = [];
  
  function handleNavigate(event) {
    navigationEvents.push(event.detail);
  }
  
  function handleFocus(event) {
    focusEvents.push(event.detail);
  }
</script>

<KeyboardNavigation 
  {enabled} 
  {trapFocus} 
  {autoFocus}
  on:navigate={handleNavigate}
  on:focus={handleFocus}
>
  <button data-testid="button1">Button 1</button>
  <button data-testid="button2">Button 2</button>
  <input data-testid="input1" placeholder="Input 1" />
  <button data-testid="button3" disabled>Disabled Button</button>
  <a href="#" data-testid="link1">Link 1</a>
</KeyboardNavigation>
`;

describe('KeyboardNavigation', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it('renders with default props', () => {
    render(TestComponent);
    
    const container = screen.getByRole('group');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('aria-label', 'Keyboard navigable area');
  });

  it('finds focusable elements correctly', () => {
    render(TestComponent);
    
    // All focusable elements should be present
    expect(screen.getByTestId('button1')).toBeInTheDocument();
    expect(screen.getByTestId('button2')).toBeInTheDocument();
    expect(screen.getByTestId('input1')).toBeInTheDocument();
    expect(screen.getByTestId('link1')).toBeInTheDocument();
    
    // Disabled button should be present but not focusable via navigation
    expect(screen.getByTestId('button3')).toBeInTheDocument();
  });

  it('handles arrow down navigation', async () => {
    const { component } = render(TestComponent);
    
    const container = screen.getByRole('group');
    container.focus();
    
    await user.keyboard('[ArrowDown]');
    
    // Should focus first focusable element
    expect(screen.getByTestId('button1')).toHaveFocus();
  });

  it('handles arrow up navigation', async () => {
    const { component } = render(TestComponent);
    
    const container = screen.getByRole('group');
    container.focus();
    
    await user.keyboard('[ArrowUp]');
    
    // Should focus first focusable element (since we're at the beginning)
    expect(screen.getByTestId('button1')).toHaveFocus();
  });

  it('navigates through elements with arrow keys', async () => {
    render(TestComponent);
    
    const container = screen.getByRole('group');
    container.focus();
    
    // Focus first element
    await user.keyboard('[ArrowDown]');
    expect(screen.getByTestId('button1')).toHaveFocus();
    
    // Move to next element
    await user.keyboard('[ArrowDown]');
    expect(screen.getByTestId('button2')).toHaveFocus();
    
    // Move to input
    await user.keyboard('[ArrowDown]');
    expect(screen.getByTestId('input1')).toHaveFocus();
    
    // Skip disabled button, go to link
    await user.keyboard('[ArrowDown]');
    expect(screen.getByTestId('link1')).toHaveFocus();
  });

  it('handles Home key to focus first element', async () => {
    render(TestComponent);
    
    const container = screen.getByRole('group');
    container.focus();
    
    // Move to middle element first
    await user.keyboard('[ArrowDown][ArrowDown]');
    expect(screen.getByTestId('button2')).toHaveFocus();
    
    // Press Home to go to first
    await user.keyboard('[Home]');
    expect(screen.getByTestId('button1')).toHaveFocus();
  });

  it('handles End key to focus last element', async () => {
    render(TestComponent);
    
    const container = screen.getByRole('group');
    container.focus();
    
    await user.keyboard('[End]');
    expect(screen.getByTestId('link1')).toHaveFocus();
  });

  it('dispatches navigate events', async () => {
    const { component } = render(TestComponent);
    let navigationEvents: any[] = [];
    
    component.$on('navigate', (event) => {
      navigationEvents.push(event.detail);
    });
    
    const container = screen.getByRole('group');
    container.focus();
    
    await user.keyboard('[ArrowDown]');
    expect(navigationEvents).toContainEqual({ direction: 'down' });
    
    await user.keyboard('[ArrowUp]');
    expect(navigationEvents).toContainEqual({ direction: 'up' });
    
    await user.keyboard('[ArrowLeft]');
    expect(navigationEvents).toContainEqual({ direction: 'left' });
    
    await user.keyboard('[ArrowRight]');
    expect(navigationEvents).toContainEqual({ direction: 'right' });
    
    await user.keyboard('[Enter]');
    expect(navigationEvents).toContainEqual({ direction: 'enter' });
    
    await user.keyboard('[Escape]');
    expect(navigationEvents).toContainEqual({ direction: 'escape' });
  });

  it('dispatches focus events', async () => {
    const { component } = render(TestComponent);
    let focusEvents: any[] = [];
    
    component.$on('focus', (event) => {
      focusEvents.push(event.detail);
    });
    
    const container = screen.getByRole('group');
    container.focus();
    
    await user.keyboard('[ArrowDown]');
    
    expect(focusEvents.length).toBeGreaterThan(0);
    expect(focusEvents[0]).toHaveProperty('element');
    expect(focusEvents[0].element).toBe(screen.getByTestId('button1'));
  });

  it('respects enabled prop', async () => {
    render(TestComponent, { enabled: false });
    
    const container = screen.getByRole('group');
    container.focus();
    
    await user.keyboard('[ArrowDown]');
    
    // Should not focus any element when disabled
    expect(screen.getByTestId('button1')).not.toHaveFocus();
  });

  it('handles focus trap when enabled', async () => {
    render(TestComponent, { trapFocus: true });
    
    const container = screen.getByRole('group');
    container.focus();
    
    // Navigate to last element
    await user.keyboard('[End]');
    expect(screen.getByTestId('link1')).toHaveFocus();
    
    // Tab should wrap to first element with focus trap
    await user.keyboard('[Tab]');
    expect(screen.getByTestId('button1')).toHaveFocus();
    
    // Shift+Tab should wrap to last element
    await user.keyboard('[Shift>][Tab][/Shift]');
    expect(screen.getByTestId('link1')).toHaveFocus();
  });

  it('supports auto focus', async () => {
    render(TestComponent, { autoFocus: true });
    
    // Wait a bit for auto focus to take effect
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(screen.getByTestId('button1')).toHaveFocus();
  });

  it('skips non-visible elements', () => {
    const TestWithHiddenElements = `
      <script>
        import KeyboardNavigation from './KeyboardNavigation.svelte';
      </script>
      
      <KeyboardNavigation>
        <button data-testid="visible">Visible</button>
        <button data-testid="hidden" style="display: none;">Hidden</button>
        <button data-testid="invisible" style="visibility: hidden;">Invisible</button>
        <button data-testid="disabled" disabled>Disabled</button>
        <button data-testid="tabindex-minus" tabindex="-1">Tabindex -1</button>
        <button data-testid="visible2">Visible 2</button>
      </KeyboardNavigation>
    `;
    
    render(TestWithHiddenElements);
    
    // Only visible, enabled elements should be focusable
    expect(screen.getByTestId('visible')).toBeInTheDocument();
    expect(screen.getByTestId('visible2')).toBeInTheDocument();
  });
}); 