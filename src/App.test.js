import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Mock dos ícones Lucide para evitar erros de renderização
jest.mock('lucide-react', () => ({
  QrCode: () => <div data-testid="icon-qrcode" />,
  Package: () => <div data-testid="icon-package" />,
  Users: () => <div data-testid="icon-users" />,
  BarChart3: () => <div data-testid="icon-barchart" />,
  Settings: () => <div data-testid="icon-settings" />,
  Scan: () => <div data-testid="icon-scan" />,
  Plus: () => <div data-testid="icon-plus" />,
  AlertTriangle: () => <div data-testid="icon-alert" />,
  TrendingUp: () => <div data-testid="icon-trending" />,
  Download: () => <div data-testid="icon-download" />,
  Search: () => <div data-testid="icon-search" />,
  Edit: () => <div data-testid="icon-edit" />,
  Trash2: () => <div data-testid="icon-trash" />,
  Camera: () => <div data-testid="icon-camera" />,
  CheckCircle: () => <div data-testid="icon-check" />,
  Save: () => <div data-testid="icon-save" />,
  X: () => <div data-testid="icon-x" />,
  Check: () => <div data-testid="icon-check-simple" />,
  Loader2: () => <div data-testid="icon-loader" />,
  FileText: () => <div data-testid="icon-file-text" />,
  FileSpreadsheet: () => <div data-testid="icon-file-spreadsheet" />,
  Upload: () => <div data-testid="icon-upload" />,
  Clock: () => <div data-testid="icon-clock" />
}));

// Mock do Firebase
const mockSet = jest.fn();
const mockOnValue = jest.fn();
const mockRef = jest.fn();
const mockGet = jest.fn();
const mockRunTransaction = jest.fn();
const mockServerTimestamp = jest.fn();

window.firebaseDatabase = {};
window.firebaseRef = mockRef;
window.firebaseOnValue = mockOnValue;
window.firebaseSet = mockSet;
window.firebaseGet = mockGet;
window.firebaseRunTransaction = mockRunTransaction;
window.firebaseServerTimestamp = mockServerTimestamp;

describe('EstoqueFF - Testes de Sincronização Offline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorage.clear();

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true
    });
    
    // Setup padrão dos mocks
    mockRef.mockImplementation((db, path) => ({ key: path }));
    mockOnValue.mockImplementation((ref, callback) => {
      callback({ val: () => null }); // Dados iniciais vazios
      return () => {}; // Unsubscribe function
    });
    mockSet.mockResolvedValue(true);
    mockGet.mockImplementation(async (refObj) => {
      const key = refObj?.key;
      if (key === 'estoqueff_state') {
        return {
          exists: () => true,
          val: () => ({
            products: [
              { id: 'P001', name: 'Produto Base', stock: 10, stockVersion: 0 }
            ],
            movements: [],
            audit: [],
            meta: { schemaVersion: 1, lastUpdatedAt: 'server_ts' }
          })
        };
      }
      return { exists: () => false, val: () => null };
    });
    mockServerTimestamp.mockImplementation(() => 'server_ts');
    mockRunTransaction.mockImplementation(async (ref, updater) => {
      const current = {
        products: [
          { id: 'P001', name: 'Produto Base', stock: 10, stockVersion: 0 }
        ],
        movements: [],
        audit: [],
        meta: { schemaVersion: 1, lastUpdatedAt: 'server_ts' }
      };
      updater(current);
      return { committed: true };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const login = async () => {
    fireEvent.change(screen.getByPlaceholderText('Digite seu usuário'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Digite sua senha'), { target: { value: '123' } });
    fireEvent.click(screen.getByText('Entrar'));
    await screen.findByText('EstoqueFF Dashboard');
  };

  test('Deve renderizar o dashboard corretamente após login', async () => {
    await act(async () => {
      render(<App />);
    });
    
    await login();
    
    expect(screen.getByText('EstoqueFF Dashboard')).toBeInTheDocument();
  });

  test('Deve carregar dados do localStorage se houver (Simulação de Reload Offline)', async () => {
    // Prepara dados locais simulando um estado salvo offline
    const localMovements = [
      { id: 'offline1', product: 'Produto Teste', productId: 'P001', quantity: 10, type: 'entrada', status: 'pending', date: '2025-08-20 10:00' }
    ];
    
    localStorage.setItem('estoqueff_cache_movements_v1', JSON.stringify(localMovements));

    await act(async () => {
      render(<App />);
    });

    // Login necessário para ver o dashboard e disparar efeitos que dependem de renderização completa
    await login();

    // Avança timers para permitir que o useEffect processe o localStorage
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.getByText('Produto Teste')).toBeInTheDocument();
  });

  test('Deve exibir indicador de sincronização quando ocorrer flush da fila', async () => {
    localStorage.setItem(
      'estoqueff_inventory_ops_queue_v1',
      JSON.stringify([
        {
          opId: 'op1',
          type: 'movement',
          payload: {
            movement: {
              id: 'm1',
              product: 'Produto Base',
              productId: 'P001',
              type: 'entrada',
              quantity: 1,
              userId: 'user1',
              userName: 'Administrador',
              userRole: 'admin',
              date: '2025-08-20 10:00',
              timestamp: '2025-08-20T10:00:00.000Z',
              status: 'pending'
            },
            productId: 'P001',
            movementType: 'entrada',
            quantity: 1
          },
          clientTs: Date.now(),
          deviceId: 'test_device',
          userId: 'user1',
          userName: 'Administrador'
        }
      ])
    );

    await act(async () => {
      render(<App />);
    });

    await login();

    await waitFor(() => {
      expect(mockRunTransaction).toHaveBeenCalled();
    });
  });

  test('Deve lidar com erro de conexão e tentar novamente (Retry)', async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error('Network Error'));

    localStorage.setItem(
      'estoqueff_inventory_ops_queue_v1',
      JSON.stringify([
        {
          opId: 'op1',
          type: 'movement',
          payload: {
            movement: {
              id: 'm1',
              product: 'Produto Base',
              productId: 'P001',
              type: 'entrada',
              quantity: 1,
              userId: 'user1',
              userName: 'Administrador',
              userRole: 'admin',
              date: '2025-08-20 10:00',
              timestamp: '2025-08-20T10:00:00.000Z',
              status: 'pending'
            },
            productId: 'P001',
            movementType: 'entrada',
            quantity: 1
          },
          clientTs: Date.now(),
          deviceId: 'test_device',
          userId: 'user1',
          userName: 'Administrador'
        }
      ])
    );

    await act(async () => {
      render(<App />);
    });

    await login();

    await act(async () => {
      jest.advanceTimersByTime(100); 
    });
    
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
  });

  test('Deve rejeitar operação quando not_committed virar inválida após revalidação', async () => {
    const movementId = 'm_not_committed_1';

    localStorage.setItem(
      'estoqueff_cache_movements_v1',
      JSON.stringify([
        {
          id: movementId,
          product: 'Produto Base',
          productId: 'P001',
          type: 'saída',
          quantity: 10,
          userId: 'user1',
          userName: 'Administrador',
          userRole: 'admin',
          date: '2025-08-20 10:00',
          timestamp: '2025-08-20T10:00:00.000Z',
          status: 'pending'
        }
      ])
    );

    localStorage.setItem(
      'estoqueff_inventory_ops_queue_v1',
      JSON.stringify([
        {
          opId: movementId,
          type: 'movement',
          payload: {
            movement: {
              id: movementId,
              product: 'Produto Base',
              productId: 'P001',
              type: 'saída',
              quantity: 10,
              userId: 'user1',
              userName: 'Administrador',
              userRole: 'admin',
              date: '2025-08-20 10:00',
              timestamp: '2025-08-20T10:00:00.000Z',
              status: 'pending'
            },
            productId: 'P001',
            movementType: 'saída',
            quantity: 10
          },
          clientTs: Date.now(),
          deviceId: 'test_device',
          userId: 'user1',
          userName: 'Administrador'
        }
      ])
    );

    let stateCall = 0;
    mockGet.mockImplementation(async (refObj) => {
      const key = refObj?.key;
      if (key === 'estoqueff_state') {
        stateCall += 1;
        if (stateCall === 1) {
          return {
            exists: () => true,
            val: () => ({
              products: [{ id: 'P001', name: 'Produto Base', stock: 10, stockVersion: 0 }],
              movements: [],
              audit: [],
              meta: { schemaVersion: 1, lastUpdatedAt: 'server_ts' }
            })
          };
        }
        return {
          exists: () => true,
          val: () => ({
            products: [{ id: 'P001', name: 'Produto Base', stock: 0, stockVersion: 0 }],
            movements: [],
            audit: [],
            meta: { schemaVersion: 1, lastUpdatedAt: 'server_ts' }
          })
        };
      }
      return { exists: () => false, val: () => null };
    });

    mockRunTransaction.mockResolvedValue({ committed: false });

    await act(async () => {
      render(<App />);
    });

    await login();

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    const queueAfter = JSON.parse(localStorage.getItem('estoqueff_inventory_ops_queue_v1') || '[]');
    expect(queueAfter.length).toBe(0);

    const rejected = JSON.parse(localStorage.getItem('estoqueff_inventory_ops_rejected_v1') || '[]');
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected[rejected.length - 1].reason).toBe('insufficient_stock');
  });
});
