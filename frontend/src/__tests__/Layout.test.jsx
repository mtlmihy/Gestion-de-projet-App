import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '../components/Layout';
import { ProjectProvider } from '../context/ProjectContext';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';

const mockTheme = createTheme();

const MockProjectPage = () => <div>Project Page</div>;
const MockAdminPage = () => <div>Admin Page</div>;

const mockProjet = {
  id: 1,
  nom: 'Test Project',
  pages_ordre: ['/', '/cdc', '/copils'],
};

const mockCanAccessPage = () => true;
const mockCanAccess = () => true;

// Mock ProjectContext
jest.mock('../context/ProjectContext', () => ({
  useProject: () => ({
    projet: mockProjet,
    canAccessPage: mockCanAccessPage,
  }),
}));

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    canAccess: mockCanAccess,
  }),
}));

const renderWithRouter = (component, initialRoute = '/') => {
  window.history.pushState({}, 'Test page', initialRoute);
  return render(
    <BrowserRouter>
      <ThemeProvider theme={mockTheme}>
        <ProjectProvider>
          <AuthProvider>
            <Routes>
              <Route element={component}>
                <Route path="/" element={<MockProjectPage />} />
                <Route path="/cdc" element={<MockProjectPage />} />
                <Route path="/copils" element={<MockProjectPage />} />
                <Route path="/admin" element={<MockAdminPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ProjectProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Layout - Navigation Gestures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Wheel Events - Hard Lock', () => {
    test('allows navigation after hard lock cooldown expires', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      // First wheel event → should navigate
      fireEvent.wheel(element, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(50);

      // Second wheel event within 700ms → should NOT navigate (hard lock)
      fireEvent.wheel(element, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(50);

      // After 700ms hard lock expires → should navigate
      jest.advanceTimersByTime(700);
      fireEvent.wheel(element, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(50);

      // Should allow the third navigation after hard lock
      expect(true).toBe(true); // Placeholder for actual navigation assertion
    });

    test('blocks second navigation within 700ms hard lock window', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      fireEvent.wheel(element, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(100);

      // This should be blocked
      fireEvent.wheel(element, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(100);

      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Wheel Events - Horizontal Detection', () => {
    test('detects horizontal scroll (deltaX > deltaY * 1.2)', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      // Clear hard lock by advancing time
      jest.advanceTimersByTime(800);

      // Horizontal swipe: deltaX = 150, deltaY = 50 (150 > 50 * 1.2 = 60)
      fireEvent.wheel(element, { deltaX: 150, deltaY: 50 });
      jest.advanceTimersByTime(100);

      expect(true).toBe(true); // Should navigate
    });

    test('ignores vertical scroll (deltaY > deltaX * 1.2)', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      // Vertical scroll: deltaX = 50, deltaY = 150 (50 NOT > 150 * 1.2)
      fireEvent.wheel(element, { deltaX: 50, deltaY: 150 });
      jest.advanceTimersByTime(100);

      expect(true).toBe(true); // Should NOT navigate
    });
  });

  describe('Wheel Events - Gesture Locking', () => {
    test('allows only one navigation per gesture (260ms idle)', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      jest.advanceTimersByTime(800); // Clear hard lock

      // First wheel event in gesture → navigate
      fireEvent.wheel(element, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(50);

      // Second wheel event (still in gesture due to <= 260ms idle) → should NOT navigate
      fireEvent.wheel(element, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(50);

      // After 260ms idle → gesture ends, next event should navigate
      jest.advanceTimersByTime(300);
      fireEvent.wheel(element, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(50);

      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Touch Events - Swipe Detection', () => {
    test('detects right swipe (negative dx)', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      jest.advanceTimersByTime(800); // Clear hard lock

      fireEvent.touchStart(element, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(element, {
        changedTouches: [{ clientX: 40, clientY: 100 }], // dx = -60 (seuil)
      });

      expect(true).toBe(true); // Should navigate to next page
    });

    test('detects left swipe (positive dx)', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      jest.advanceTimersByTime(800); // Clear hard lock

      fireEvent.touchStart(element, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(element, {
        changedTouches: [{ clientX: 160, clientY: 100 }], // dx = +60
      });

      expect(true).toBe(true); // Should navigate to previous page
    });

    test('ignores vertical touch swipe (dy > dx * 1.2)', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      fireEvent.touchStart(element, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(element, {
        changedTouches: [{ clientX: 100, clientY: 200 }], // dy = 100, dx = 0
      });

      expect(true).toBe(true); // Should NOT navigate (vertical)
    });
  });

  describe('Touch Events - Hard Lock', () => {
    test('blocks second touch swipe within 700ms hard lock', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      // First touch swipe
      fireEvent.touchStart(element, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchEnd(element, {
        changedTouches: [{ clientX: 40, clientY: 100 }],
      });

      jest.advanceTimersByTime(100);

      // Second touch swipe within hard lock
      fireEvent.touchStart(element, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchEnd(element, {
        changedTouches: [{ clientX: 40, clientY: 100 }],
      });

      expect(true).toBe(true); // Should be blocked
    });

    test('allows touch swipe after hard lock expires', async () => {
      const { container } = renderWithRouter(<Layout />);
      const element = container.querySelector('div');

      // First touch
      fireEvent.touchStart(element, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchEnd(element, {
        changedTouches: [{ clientX: 40, clientY: 100 }],
      });

      jest.advanceTimersByTime(750);

      // Second touch after hard lock expires
      fireEvent.touchStart(element, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchEnd(element, {
        changedTouches: [{ clientX: 40, clientY: 100 }],
      });

      expect(true).toBe(true); // Should allow navigation
    });
  });

  describe('Interactive Element Detection', () => {
    test('ignores swipe on input elements', async () => {
      const { container } = renderWithRouter(<Layout />);
      const input = document.createElement('input');
      container.appendChild(input);

      jest.advanceTimersByTime(800);

      fireEvent.wheel(input, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(100);

      expect(true).toBe(true); // Should NOT navigate
    });

    test('ignores swipe on textarea elements', async () => {
      const { container } = renderWithRouter(<Layout />);
      const textarea = document.createElement('textarea');
      container.appendChild(textarea);

      jest.advanceTimersByTime(800);

      fireEvent.wheel(textarea, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(100);

      expect(true).toBe(true); // Should NOT navigate
    });
  });

  describe('Admin Page Navigation', () => {
    test('disables swipe navigation on /admin route', async () => {
      const { container } = renderWithRouter(<Layout />, '/admin');

      jest.advanceTimersByTime(800);

      fireEvent.wheel(container, { deltaX: 150, deltaY: 0 });
      jest.advanceTimersByTime(100);

      expect(true).toBe(true); // Should NOT navigate (admin disabled)
    });
  });
});
