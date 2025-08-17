import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, Package, BarChart3, Settings, Scan, Plus, AlertTriangle, TrendingUp, Download, Search, Edit, Trash2, Camera, CheckCircle, Save, X, Check, Loader2, FileText, FileSpreadsheet, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import jsQR from 'jsqr';
import './App.css';

// Hook para localStorage
const useStoredState = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
};

// Componente de pesquisa
const ProductSearch = React.memo(({ onSearchChange, searchTerm }) => {
  const handleChange = useCallback((e) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const clearSearch = useCallback(() => {
    onSearchChange('');
  }, [onSearchChange]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
      <input
        type="text"
        placeholder="Pesquisar por nome, código ou marca..."
        value={searchTerm}
        onChange={handleChange}
        className="w-full px-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{ fontSize: '16px' }}
      />
      {searchTerm && (
        <X
          className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600"
          onClick={clearSearch}
        />
      )}
    </div>
  );
});

// Componente de lista de produtos
const ProductList = React.memo(({ products, searchTerm, onEdit, onDelete }) => {
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase().trim();
    return products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      product.id.toLowerCase().includes(term) ||
      (product.brand && product.brand.toLowerCase().includes(term)) ||
      product.category.toLowerCase().includes(term) ||
      (product.code && product.code.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  if (filteredProducts.length === 0 && searchTerm) {
    return (
      <div className="text-center py-10">
        <h3 className="text-lg font-semibold text-gray-700">Nenhum produto encontrado</h3>
        <p className="text-gray-500 mt-2">
          Tente pesquisar com outras palavras-chave ou verifique se o produto está cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 py-8">
      {filteredProducts.map(product => (
        <div key={product.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
              <p className="text-gray-500 text-sm">
                {product.brand && `${product.brand} • `}{product.category}
              </p>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => onEdit(product)} className="p-1 text-gray-400 hover:text-green-500" title="Editar produto">
                <Edit size={20} />
              </button>
              <button onClick={() => onDelete(product.id)} className="p-1 text-gray-400 hover:text-red-500" title="Excluir produto">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            Código: {product.code || 'Não informado'}
          </p>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-gray-600">Estoque</span>
              <span className="text-xl font-bold text-gray-800">{product.stock}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-gray-600">Mín</span>
              <span className="text-xl font-bold text-gray-800">{product.minStock}</span>
            </div>
            {product.stock <= product.minStock && (
              <div className="flex items-center gap-1 text-yellow-600 font-semibold text-sm">
                <AlertTriangle size={16} /> Estoque baixo
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

// Editor de etiquetas individual por produto
const LabelEditor = React.memo(({ productId, product, currentConfig, onConfigUpdate, onClose, companySettings }) => {
  const [localConfig, setLocalConfig] = useState(currentConfig);

  useEffect(() => {
    setLocalConfig(currentConfig);
  }, [currentConfig]);

  const handleConfigChange = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const saveConfig = () => {
    onConfigUpdate(productId, localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-2xl font-bold text-gray-800">Configurar Etiqueta para: {product?.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X size={30} />
          </button>
        </div>

        {/* Preview em tempo real */}
        <div className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="text-xl font-semibold text-gray-700 mb-4">Preview da Etiqueta</h4>
          <p className="text-sm text-gray-500 mb-4">* Configuração salva individualmente para "{product?.name}"</p>
          <div className="flex justify-center">
            <LabelPreview product={product} labelTemplate={localConfig} companySettings={companySettings} />
          </div>
        </div>

        {/* Elementos da etiqueta */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div>
            <h4 className="text-lg font-semibold text-gray-700 mb-3">Elementos da Etiqueta</h4>
            <label className="flex items-center space-x-3 text-gray-700 mb-2">
              <input type="checkbox" checked={localConfig.showBrand} onChange={(e) => handleConfigChange('showBrand', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
              <span>Marca do produto</span>
            </label>
            <label className="flex items-center space-x-3 text-gray-700 mb-2">
              <input type="checkbox" checked={localConfig.showCode} onChange={(e) => handleConfigChange('showCode', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
              <span>Código do produto</span>
            </label>
            <label className="flex items-center space-x-3 text-gray-700 mb-2">
              <input type="checkbox" checked={localConfig.showDescription} onChange={(e) => handleConfigChange('showDescription', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
              <span>Nome do produto</span>
            </label>
            <label className="flex items-center space-x-3 text-gray-700 mb-2">
              <input type="checkbox" checked={localConfig.showQuantity} onChange={(e) => handleConfigChange('showQuantity', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
              <span>Quantidade</span>
            </label>
            <label className="flex items-center space-x-3 text-gray-700 mb-2">
              <input type="checkbox" checked={localConfig.showQRCode} onChange={(e) => handleConfigChange('showQRCode', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
              <span>QR Code</span>
            </label>
            <label className="flex items-center space-x-3 text-gray-700 mb-2">
              <input type="checkbox" checked={localConfig.showBorder} onChange={(e) => handleConfigChange('showBorder', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
              <span>Borda</span>
            </label>
          </div>

          {/* Configuração de quantidade personalizada */}
          {localConfig.showQuantity && (
            <div>
              <h4 className="text-lg font-semibold text-gray-700 mb-3">Texto da Quantidade</h4>
              <input
                type="text"
                value={localConfig.customQuantity}
                onChange={(e) => handleConfigChange('customQuantity', e.target.value)}
                className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                style={{ fontSize: '16px' }}
                placeholder={`Ex: Lote 2025-001 (padrão: Qtd: ${product?.stock || 0})`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              <p className="text-sm text-gray-500 mt-2">💡 Deixe vazio para usar "Qtd: [estoque atual]" automaticamente</p>
            </div>
          )}

          {/* Tamanhos de fonte */}
          <div>
            <h4 className="text-lg font-semibold text-gray-700 mb-3">Tamanhos de Fonte (pontos)</h4>
            {localConfig.showBrand && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Marca:</label>
                <input
                  type="number"
                  value={localConfig.brandFontSize}
                  onChange={(e) => handleConfigChange('brandFontSize', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            {(localConfig.showCode || localConfig.showDescription) && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Produto:</label>
                <input
                  type="number"
                  value={localConfig.codeFontSize}
                  onChange={(e) => handleConfigChange('codeFontSize', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            {localConfig.showQuantity && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade:</label>
                <input
                  type="number"
                  value={localConfig.quantityFontSize}
                  onChange={(e) => handleConfigChange('quantityFontSize', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            {localConfig.showQRCode && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">QR Code (mm):</label>
                <input
                  type="number"
                  value={localConfig.qrSize}
                  onChange={(e) => handleConfigChange('qrSize', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* Cores */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-700 mb-3">Cores</h4>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor do Texto</label>
              <input
                type="color"
                value={localConfig.textColor}
                onChange={(e) => handleConfigChange('textColor', e.target.value)}
                className="w-full h-10 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor de Fundo</label>
              <input
                type="color"
                value={localConfig.backgroundColor}
                onChange={(e) => handleConfigChange('backgroundColor', e.target.value)}
                className="w-full h-10 border border-gray-300 rounded"
              />
            </div>
            {localConfig.showBorder && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cor da Borda</label>
                <input
                  type="color"
                  value={localConfig.borderColor}
                  onChange={(e) => handleConfigChange('borderColor', e.target.value)}
                  className="w-full h-10 border border-gray-300 rounded"
                />
              </div>
            )}
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button onClick={onClose} className="px-6 py-3 rounded-lg font-medium border border-gray-300 hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
          <button onClick={saveConfig} className="px-6 py-3 rounded-lg font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors">
            Salvar Configuração
          </button>
        </div>
      </div>
    </div>
  );
});

// Preview da etiqueta
const LabelPreview = React.memo(({ product, labelTemplate, companySettings }) => {
  if (!product || !labelTemplate) return null;

  const ptToPx = 1.33; // Aproximação
  const mmToPxPreview = 1.2; // Ajuste para preview em tela

  const calculatedWidth = labelTemplate.labelWidth || 85; // Largura em mm, padrão 85mm
  const calculatedHeight = labelTemplate.labelHeight || 60; // Altura em mm, padrão 60mm
  const widthPx = calculatedWidth * mmToPxPreview;
  const heightPx = calculatedHeight * mmToPxPreview;

  const previewStyle = {
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    backgroundColor: labelTemplate.backgroundColor,
    color: labelTemplate.textColor,
    border: labelTemplate.showBorder ? `2px solid ${labelTemplate.borderColor}` : 'none',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    boxSizing: 'border-box',
    fontSize: '12px', // Base font size for preview
    overflow: 'hidden',
    position: 'relative' // For border positioning
  };

  const textStyle = (fontSize, weight = 'normal') => ({
    fontSize: `${fontSize}pt`,
    fontWeight: weight,
    textAlign: 'center',
    wordBreak: 'break-word'
  });

  const qrSizePx = labelTemplate.qrSize * mmToPxPreview;

  return (
    <div style={previewStyle} className="relative border border-dashed border-gray-300 overflow-hidden">
      {/* Área superior centralizada */}
      {labelTemplate.showBrand && product.brand && (
        <div style={textStyle(labelTemplate.brandFontSize || 18, 'bold')} className="w-full text-center break-all">
          {product.brand}
        </div>
      )}

      <div style={textStyle(labelTemplate.codeFontSize || 12)} className="w-full text-center break-all">
        {(labelTemplate.showCode && labelTemplate.showDescription && product.name) ? `${product.code || ''} - ${product.name}` : ''}
        {labelTemplate.showCode && !labelTemplate.showDescription && (product.code || '')}
        {!labelTemplate.showCode && labelTemplate.showDescription && product.name}
      </div>

      {/* Área inferior */}
      <div className="w-full flex justify-between items-end mt-auto">
        {labelTemplate.showQuantity && (
          <div style={textStyle(labelTemplate.quantityFontSize || 14, 'bold')} className="flex-1 pr-2 break-words">
            {labelTemplate.customQuantity.trim() || `${product.stock}`}
          </div>
        )}
        {labelTemplate.showQRCode && (
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-gray-200 flex items-center justify-center text-gray-500 text-xs" style={{ width: `${qrSizePx}px`, height: `${qrSizePx}px` }}>
              QR
            </div>
          </div>
        )}
      </div>

      {/* Borda individual se habilitada no template */}
      {labelTemplate.showBorder && (
        <div
          className="absolute inset-0 border-2"
          style={{ borderColor: labelTemplate.borderColor, top: '2px', left: '2px', right: '2px', bottom: '2px' }}
        ></div>
      )}
    </div>
  );
});

// Mova defaultLabelConfig para fora do componente
const defaultLabelConfig = {
  showBrand: true,
  showCode: false,
  showDescription: true,
  showQuantity: true,
  showQRCode: true,
  customQuantity: '',
  brandFontSize: 18,
  codeFontSize: 12,
  descriptionFontSize: 10, // Corrigido para descriptionFontSize
  quantityFontSize: 14,
  qrSize: 20,
  backgroundColor: '#ffffff',
  textColor: '#000000',
  borderColor: '#cccccc',
  showBorder: true,
  labelWidth: 85, // Largura em mm
  labelHeight: 60 // Altura em mm
};

const EstoqueFFApp = () => {
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // Estados usando localStorage

  const [products, setProducts] = useStoredState('estoqueff_products', [
    { id: 'P001', name: 'Notebook Dell', brand: 'Dell', category: 'Eletrônicos', code: 'NB-DELL-001', stock: 15, minStock: 5, qrCode: 'QR001', createdAt: '2025-01-01' },
    { id: 'P002', name: 'Mouse Logitech', brand: 'Logitech', category: 'Acessórios', code: 'MS-LOG-002', stock: 3, minStock: 10, qrCode: 'QR002', createdAt: '2025-01-01' },
    { id: 'P003', name: 'Teclado Mecânico', brand: 'Razer', category: 'Acessórios', code: 'KB-RZR-003', stock: 8, minStock: 5, qrCode: 'QR003', createdAt: '2025-01-01' },
    { id: 'P004', name: 'Monitor 24"', brand: 'Samsung', category: 'Eletrônicos', code: 'MN-SAM-004', stock: 12, minStock: 3, qrCode: 'QR004', createdAt: '2025-01-01' }
  ]);

  const [movements, setMovements] = useStoredState('estoqueff_movements', [
    { id: '1', product: 'Notebook Dell', productId: 'P001', type: 'saída', quantity: 2, user: 'João Silva', date: '2025-08-04 14:30', timestamp: '2025-08-04T17:30:00.000Z' },
    { id: '2', product: 'Mouse Logitech', productId: 'P002', type: 'entrada', quantity: 5, user: 'Maria Santos', date: '2025-08-04 12:15', timestamp: '2025-08-04T15:15:00.000Z' },
    { id: '3', product: 'Monitor 24"', productId: 'P004', type: 'saída', quantity: 1, user: 'Pedro Costa', date: '2025-08-04 10:45', timestamp: '2025-08-04T13:45:00.000Z' }
  ]);

  const [companySettings, setCompanySettings] = useStoredState('estoqueff_settings', {
    companyName: 'Minha Empresa',
    responsibleName: 'Juninho Rezini',
    lowStockAlert: true
  });

  const [productLabelConfigs, setProductLabelConfigs] = useStoredState('estoqueff_product_label_configs', {});

  // Estados gerais
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [movementType, setMovementType] = useState('');
  const [movementQuantity, setMovementQuantity] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [editingLabelForProduct, setEditingLabelForProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Estados para movimentação manual
  const [showManualMovement, setShowManualMovement] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualSelectedProduct, setManualSelectedProduct] = useState(null);

  // Estados de pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [labelSearchTerm, setLabelSearchTerm] = useState('');

  // Estados para novo produto
  const [newProduct, setNewProduct] = useState({
    name: '', brand: '', category: '', code: '', stock: 0, minStock: 1
  });

  // Estados para relatórios
  const [reportsTab, setReportsTab] = useState('movements');
  const [movementsPeriodFilter, setMovementsPeriodFilter] = useState('all');
  const [productsFilter, setProductsFilter] = useState('all');

  // Fix para teclado mobile
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1, user-scalable=no'; // Adicionado user-scalable=no
    if (!document.head.contains(viewport)) {
      document.head.appendChild(viewport);
    }
  }, []);

  // Handlers estáveis
  const handleSearchChange = useCallback((newSearchTerm) => {
    setSearchTerm(newSearchTerm);
  }, []);

  const handleLabelSearchChange = useCallback((newSearchTerm) => {
    setLabelSearchTerm(newSearchTerm);
  }, []);

  const handleManualSearchChange = useCallback((newSearchTerm) => {
    setManualSearchTerm(newSearchTerm);
  }, []);

  const handleEditProduct = useCallback((product) => {
    setEditingProduct(product);
  }, []);

  const handleDeleteProduct = useCallback((productId) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
      setProductLabelConfigs(prevConfigs => {
        const newConfigs = { ...prevConfigs };
        delete newConfigs[productId];
        return newConfigs;
      });
      setSuccess('Produto excluído com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    }
  }, [setProducts, setProductLabelConfigs]);

  // Funções para configurações de etiquetas
  const getProductLabelConfig = useCallback((productId) => {
    return productLabelConfigs[productId] || defaultLabelConfig;
  }, [productLabelConfigs]);

  const updateProductLabelConfig = useCallback((productId, newConfig) => {
    setProductLabelConfigs(prevConfigs => ({
      ...prevConfigs,
      [productId]: { ...defaultLabelConfig, ...prevConfigs[productId], ...newConfig }
    }));
  }, [setProductLabelConfigs]);

  const openLabelEditorForProduct = useCallback((productId) => {
    setEditingLabelForProduct(productId);
    setShowLabelEditor(true);
  }, []);

  const closeLabelEditor = useCallback(() => {
    setEditingLabelForProduct(null);
    setShowLabelEditor(false);
  }, []);

  // ✅ FUNÇÃO CORRIGIDA: Scanner QR Code com câmera real
  const startRealQRScanner = async () => {
    // ✅ CLEANUP inicial de qualquer estado anterior
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    setLoading(true);
    setScannerActive(true);
    setErrors({});
    setMovementType('');

    try {
      console.log('Solicitando acesso à câmera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      console.log('Stream obtido:', stream);
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // ✅ TIMEOUT mais agressivo
        const loadTimeout = setTimeout(() => {
          console.log('Timeout da câmera atingido');
          setLoading(false);
          setErrors({ camera: 'Tempo limite para carregar câmera excedido.' });
          stopCamera();
        }, 3000); // ✅ Reduzido para 3s

        const handleLoadedMetadata = async () => {
          try {
            console.log('Metadados carregados, tentando play...');
            clearTimeout(loadTimeout);
            
            // ✅ PLAY simples sem Promise.race
            await videoRef.current.play();
            
            console.log('Play successful, stopping loading...');
            setLoading(false); // ✅ CRÍTICO: Para o loading AQUI
            
            // ✅ INICIA scanning
            const scanQRCode = () => {
              if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                
                if (canvas.width > 0 && canvas.height > 0) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const code = jsQR(imageData.data, imageData.width, imageData.height);
                  
                  if (code) {
                    clearInterval(scanIntervalRef.current);
                    scanIntervalRef.current = null;
                    
                    const foundProduct = findProductByQR(code.data);
                    
                    if (foundProduct) {
                      setScannedProduct(foundProduct);
                      stopCamera();
                      setSuccess(`✅ Produto "${foundProduct.name}" encontrado!`);
                      setTimeout(() => setSuccess(''), 3000);
                    } else {
                      setErrors({
                        general: 'QR Code não reconhecido. Verifique se o produto está cadastrado.',
                      });
                      stopCamera();
                      setTimeout(() => setErrors({}), 3000);
                    }
                  }
                }
              }
            };

            scanIntervalRef.current = setInterval(scanQRCode, 100);
            
          } catch (error) {
            clearTimeout(loadTimeout);
            console.error('Erro no play:', error);
            setErrors({ camera: `Erro ao iniciar vídeo: ${error.message}` });
            setLoading(false);
            stopCamera();
          }
        };

        videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      setErrors({
        camera: 'Não foi possível acessar a câmera. Verifique as permissões.',
      });
      setScannerActive(false);
      setLoading(false);
    }
  };

  const stopCamera = () => {
    // ✅ Limpa o intervalo de escaneamento primeiro
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setScannerActive(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setLoading(false); // ✅ Garante que o loading seja desativado
    setScannedProduct(null); // Limpa o produto escaneado ao parar a câmera
  };

  const findProductByQR = (qrCodeData) => {
    // Tenta encontrar por ID ou pelo valor literal do QR Code se ele for um ID válido
    const foundById = products.find(p => p.id === qrCodeData);
    if (foundById) return foundById;

    // Se o QR Code contiver dados específicos que identificam o produto (ex: "ESTOQUEFF_P001_NOTEBOOK")
    if (qrCodeData.startsWith('ESTOQUEFF_')) {
      const parts = qrCodeData.split('_');
      if (parts.length > 1) {
        const productId = parts[1];
        return products.find(p => p.id === productId);
      }
    }
    // Retorna null se nenhum produto for encontrado
    return null;
  };

  // ✅ EFEITO CORRIGIDO: Limpeza da câmera e do intervalo
  useEffect(() => {
    const currentStream = cameraStream;
    const currentInterval = scanIntervalRef.current;

    return () => {
      // Limpa o intervalo
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      // Para a câmera
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      // Limpa a referência do vídeo
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      // Garante que o estado do scanner seja resetado ao desmontar
      setScannerActive(false);
      setScannedProduct(null);
      setLoading(false);
    };
  }, [cameraStream]);

  // Validação de produtos
  const validateProduct = (product, isEdit = false) => {
    const newErrors = {};
    if (!product.name || product.name.trim().length < 2) {
      newErrors.name = 'Nome deve ter pelo menos 2 caracteres';
    }
    if (!product.category || product.category.trim().length < 2) {
      newErrors.category = 'Categoria deve ter pelo menos 2 caracteres';
    }
    const stock = parseInt(product.stock);
    if (isNaN(stock) || stock < 0) {
      newErrors.stock = 'Estoque deve ser um número válido maior ou igual a 0';
    }
    const minStock = parseInt(product.minStock);
    if (isNaN(minStock) || minStock < 1) {
      newErrors.minStock = 'Estoque mínimo deve ser um número válido maior que 0';
    }
    if (!product.code || product.code.trim().length < 2) {
      newErrors.code = 'Código deve ter pelo menos 2 caracteres';
    }

    if (!isEdit) {
      const nameExists = products.some(p => p.name.toLowerCase().trim() === product.name.toLowerCase().trim());
      if (nameExists) {
        newErrors.name = 'Já existe um produto com este nome';
      }
    }
    return newErrors;
  };

  // ✅ FUNÇÃO CORRIGIDA: Adicionar produto com finally
  const addProduct = () => {
    setLoading(true);
    setErrors({});
    const validationErrors = validateProduct(newProduct);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const productId = 'P' + String(Date.now()).slice(-6);
      const qrCodeData = `ESTOQUEFF_ID=${productId}_NM=${newProduct.name.replace(/\s+/g, '_').toUpperCase()}`;
      const product = {
        ...newProduct,
        name: newProduct.name.trim(),
        brand: newProduct.brand?.trim() || '',
        category: newProduct.category.trim(),
        code: newProduct.code.trim(),
        id: productId,
        qrCode: qrCodeData,
        createdAt: new Date().toISOString().split('T')[0],
        stock: parseInt(newProduct.stock),
        minStock: parseInt(newProduct.minStock)
      };
      setProducts([...products, product]);
      setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 });
      setShowAddProduct(false);
      setSuccess(`✅ Produto "${product.name}" adicionado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error("Erro ao adicionar produto:", error);
      setErrors({ general: 'Erro ao adicionar produto. Tente novamente.' });
    } finally {
      setLoading(false); // ✅ SEMPRE executa
    }
  };

  // ✅ FUNÇÃO CORRIGIDA: Atualizar produto com finally
  const updateProduct = () => {
    setLoading(true);
    setErrors({});
    const validationErrors = validateProduct(editingProduct, true);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      setProducts(products.map(p => p.id === editingProduct.id ? {
        ...editingProduct,
        name: editingProduct.name.trim(),
        brand: editingProduct.brand?.trim() || '',
        category: editingProduct.category.trim(),
        code: editingProduct.code.trim(),
        stock: parseInt(editingProduct.stock),
        minStock: parseInt(editingProduct.minStock)
      } : p));
      setEditingProduct(null);
      setSuccess(`✅ Produto atualizado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      setErrors({ general: 'Erro ao atualizar produto. Tente novamente.' });
    } finally {
      setLoading(false); // ✅ SEMPRE executa
    }
  };

  // ✅ FUNÇÃO CORRIGIDA: Processar movimentação com finally
  const processMovement = (product = null) => {
    const targetProduct = product || scannedProduct || manualSelectedProduct;
    if (!targetProduct) return;

    setLoading(true);
    setErrors({});
    const quantity = parseInt(movementQuantity);

    if (isNaN(quantity) || quantity <= 0) {
      setErrors({ quantity: 'Quantidade deve ser um número válido maior que 0' });
      setLoading(false);
      return;
    }

    if (!movementType) {
      setErrors({ movement: 'Selecione o tipo de movimentação (Entrada ou Saída)' });
      setLoading(false);
      return;
    }

    // Verifica estoque para saída
    if (movementType === 'saída' && targetProduct.stock < quantity) {
      setErrors({ quantity: `Estoque insuficiente! Disponível: ${targetProduct.stock} unidades` });
      setLoading(false);
      return;
    }

    try {
      const newMovement = {
        id: Date.now().toString(),
        product: targetProduct.name,
        productId: targetProduct.id,
        type: movementType,
        quantity,
        user: companySettings.responsibleName,
        date: new Date().toLocaleString('pt-BR'),
        timestamp: new Date().toISOString()
      };
      setMovements([newMovement, ...movements]);

      setProducts(products.map(p =>
        p.id === targetProduct.id
          ? { ...p, stock: movementType === 'entrada' ? p.stock + quantity : p.stock - quantity }
          : p
      ));

      // Reset estados
      setScannedProduct(null);
      setManualSelectedProduct(null);
      setShowManualMovement(false);
      setManualSearchTerm('');
      setMovementType('');
      setMovementQuantity(1);
      setSuccess(`✅ ${movementType === 'entrada' ? 'Entrada' : 'Saída'} de ${quantity} unidades registrada com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error("Erro ao processar movimentação:", error);
      setErrors({ general: 'Erro ao processar movimentação. Tente novamente.' });
    } finally {
      setLoading(false); // ✅ SEMPRE executa
    }
  };

  // Exportação para PDF
  const exportToPDF = (type, data, title) => {
    const pdf = new jsPDF();
    const timestamp = new Date().toLocaleString('pt-BR');

    // Cabeçalho
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, 14, 22);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${companySettings.companyName}`, 14, 32);
    pdf.text(`Responsável: ${companySettings.responsibleName}`, 14, 38);
    pdf.text(`Gerado em: ${timestamp}`, 14, 44);
    pdf.setLineWidth(0.5);
    pdf.line(14, 48, 196, 48);

    let columns = [];
    let rows = [];

    if (type === 'products') {
      columns = [
        { header: 'Código', dataKey: 'code' },
        { header: 'Nome', dataKey: 'name' },
        { header: 'Marca', dataKey: 'brand' },
        { header: 'Categoria', dataKey: 'category' },
        { header: 'Estoque', dataKey: 'stock' },
        { header: 'Min.', dataKey: 'minStock' },
        { header: 'Status', dataKey: 'status' }
      ];
      rows = data.map(p => ({
        code: p.code || 'N/A',
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        brand: p.brand || 'N/A',
        category: p.category,
        stock: p.stock.toString(),
        minStock: p.minStock.toString(),
        status: p.stock <= p.minStock ? 'Baixo' : 'OK'
      }));
    } else if (type === 'movements') {
      columns = [
        { header: 'Produto', dataKey: 'product' },
        { header: 'Tipo', dataKey: 'type' },
        { header: 'Qtd', dataKey: 'quantity' },
        { header: 'Usuário', dataKey: 'user' },
        { header: 'Data', dataKey: 'date' }
      ];
      rows = data.map(m => ({
        product: m.product.length > 25 ? m.product.substring(0, 25) + '...' : m.product,
        type: m.type === 'entrada' ? 'Entrada' : 'Saída',
        quantity: m.quantity.toString(),
        user: m.user.length > 15 ? m.user.substring(0, 15) + '...' : m.user,
        date: m.date.split(' ')[0] // Apenas a data
      }));
    }

    autoTable(pdf, {
      columns: columns,
      body: rows,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
      columnStyles: type === 'products' ? {
        name: { cellWidth: 35 },
        brand: { cellWidth: 25 },
        category: { cellWidth: 25 }
      } : {
        product: { cellWidth: 50 },
        user: { cellWidth: 30 }
      }
    });

    // Rodapé
    const estimatedRowHeight = 12;
    const headerHeight = 15;
    const startY = 55;
    const padding = 20;
    const finalY = startY + headerHeight + (rows.length * estimatedRowHeight) + padding;

    pdf.setFontSize(8);
    pdf.text(`Total de registros: ${data.length}`, 14, finalY + 15);
    pdf.text(`EstoqueFF - Sistema de Controle de Estoque`, 14, finalY + 25);

    const filename = `${type === 'products' ? 'produtos' : 'movimentacoes'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
  };

  // Exportação para Excel
  const exportToExcel = (type, data, title) => {
    let worksheetData = [];
    let filename = '';

    if (type === 'products') {
      worksheetData = [
        [title],
        [`${companySettings.companyName}`],
        [`Responsável: ${companySettings.responsibleName}`],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [],
        ['Código', 'Nome do Produto', 'Marca', 'Categoria', 'Estoque Atual', 'Estoque Mínimo', 'Diferença', 'Status', 'Data Criação']
      ];
      data.forEach(p => {
        const diferenca = p.stock - p.minStock;
        const status = p.stock <= 0 ? 'SEM ESTOQUE' : p.stock <= p.minStock ? 'ESTOQUE BAIXO' : 'NORMAL';
        worksheetData.push([
          p.code || 'N/A',
          p.name,
          p.brand || 'N/A',
          p.category,
          p.stock,
          p.minStock,
          diferenca,
          status,
          p.createdAt || 'N/A'
        ]);
      });
      filename = `relatorio_produtos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    } else if (type === 'movements') {
      worksheetData = [
        [title],
        [`${companySettings.companyName}`],
        [`Responsável: ${companySettings.responsibleName}`],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [],
        ['ID', 'Produto', 'Tipo de Movimentação', 'Quantidade', 'Usuário', 'Data e Hora']
      ];
      data.forEach(m => {
        worksheetData.push([
          m.id,
          m.product,
          m.type === 'entrada' ? 'ENTRADA' : 'SAÍDA',
          m.quantity,
          m.user,
          m.date
        ]);
      });
      filename = `relatorio_movimentacoes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    }

    // Adiciona estatísticas no final
    worksheetData.push([]);
    worksheetData.push(['=== ESTATÍSTICAS ===']);
    worksheetData.push([`Total de registros: ${data.length}`]);

    if (type === 'products') {
      const lowStock = data.filter(p => p.stock <= p.minStock).length;
      const noStock = data.filter(p => p.stock <= 0).length;
      const totalItems = data.reduce((sum, p) => sum + p.stock, 0);
      worksheetData.push([`Produtos com estoque baixo: ${lowStock}`]);
      worksheetData.push([`Produtos sem estoque: ${noStock}`]);
      worksheetData.push([`Total de itens em estoque: ${totalItems}`]);
    } else {
      const entradas = data.filter(m => m.type === 'entrada').length;
      const saidas = data.filter(m => m.type === 'saída').length;
      const totalEntradas = data.filter(m => m.type === 'entrada').reduce((sum, m) => sum + m.quantity, 0);
      const totalSaidas = data.filter(m => m.type === 'saída').reduce((sum, m) => sum + m.quantity, 0);
      worksheetData.push([`Total de entradas: ${entradas} movimentações (${totalEntradas} itens)`]);
      worksheetData.push([`Total de saídas: ${saidas} movimentações (${totalSaidas} itens)`]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Ajuste de colunas para melhor visualização
    if (type === 'products') {
      ws['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 12 }
      ];
    } else {
      ws['!cols'] = [
        { wch: 8 }, { wch: 35 }, { wch: 18 }, { wch: 12 },
        { wch: 20 }, { wch: 18 }
      ];
    }

    // Estilos básicos para os cabeçalhos e títulos
    if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14 } };
    if (ws['A2']) ws['A2'].s = { font: { bold: true } };
    if (ws['A3']) ws['A3'].s = { font: { italic: true } };
    if (ws['A4']) ws['A4'].s = { font: { italic: true } };

    XLSX.utils.book_append_sheet(wb, ws, type === 'products' ? 'Produtos' : 'Movimentações');
    XLSX.writeFile(wb, filename);
  };

  const exportData = (type, format = 'excel') => {
    let data = [];
    let title = '';

    if (type === 'products') {
      data = filteredProducts.length > 0 ? filteredProducts : products;
      title = 'Relatório de Produtos - EstoqueFF';
    } else if (type === 'movements') {
      data = filteredMovements.length > 0 ? filteredMovements : movements;
      title = 'Relatório de Movimentações - EstoqueFF';
    }

    if (data.length === 0) {
      setErrors({ general: `Nenhum dado para exportar em "${type}" com os filtros aplicados.` });
      setTimeout(() => setErrors({}), 3000);
      return;
    }

    if (format === 'pdf') {
      exportToPDF(type, data, title);
    } else {
      exportToExcel(type, data, title);
    }
    setSuccess(`✅ Relatório ${format.toUpperCase()} gerado com sucesso! (${data.length} registros)`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Backup e Restaurar
  const createBackup = () => {
    const backup = {
      products,
      movements,
      companySettings,
      productLabelConfigs,
      backupDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estoqueff_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess('✅ Backup criado com sucesso!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const restoreBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        if (backup.products && backup.movements) {
          setProducts(backup.products);
          setMovements(backup.movements);
          if (backup.companySettings) {
            setCompanySettings(backup.companySettings);
          }
          if (backup.productLabelConfigs) {
            setProductLabelConfigs(backup.productLabelConfigs);
          }
          setSuccess('✅ Backup restaurado com sucesso!');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setErrors({ general: 'Arquivo de backup inválido!' });
          setTimeout(() => setErrors({}), 3000);
        }
      } catch (error) {
        console.error("Erro ao restaurar backup:", error);
        setErrors({ general: 'Erro ao restaurar backup!' });
        setTimeout(() => setErrors({}), 3000);
      }
    };
    reader.onerror = () => {
      setErrors({ general: 'Erro ao ler o arquivo de backup.' });
      setTimeout(() => setErrors({}), 3000);
    };
    reader.readAsText(file);
    event.target.value = ''; // Limpa o input file
  };

  // Calcular estatísticas
  const stats = useMemo(() => {
    const today = new Date();
    const todayBR = today.toLocaleDateString('pt-BR');
    const todayISO = today.toISOString().slice(0, 10);

    // Filtrar movimentos de hoje com base no formato da data armazenada
    const todayMovements = movements.filter(movement => {
      try {
        // Tenta parsear a data do movimento no formato "DD/MM/YYYY HH:MM"
        const [datePart, timePart] = movement.date.split(' ');
        const [day, month, year] = datePart.split('/');
        const movementDate = new Date(`${year}-${month}-${day}T${timePart}`);
        const movementDateISO = movementDate.toISOString().slice(0, 10);
        return movementDateISO === todayISO;
      } catch {
        // Se o formato for diferente ou der erro, ignora
        return false;
      }
    }).length;

    return {
      totalProducts: products.length,
      lowStockProducts: products.filter(p => p.stock <= p.minStock).length,
      totalItems: products.reduce((sum, p) => sum + p.stock, 0),
      todayMovements: todayMovements
    };
  }, [products, movements]);

  // Relatórios expandidos
  const filteredMovements = useMemo(() => {
    if (movementsPeriodFilter === 'all') return movements;

    const now = new Date();
    const filterDays = movementsPeriodFilter === '7days' ? 7 : 30;
    const filterDate = new Date(now.getTime() - (filterDays * 24 * 60 * 60 * 1000));

    return movements.filter(m => {
      try {
        // Converte a string de data/hora armazenada para um objeto Date
        const movementDateTime = new Date(m.timestamp); // Usar timestamp para precisão
        return movementDateTime >= filterDate;
      } catch {
        return true; // Se houver erro de parse, considera válido para não perder dados
      }
    });
  }, [movements, movementsPeriodFilter]);

  const filteredProducts = useMemo(() => {
    switch (productsFilter) {
      case 'low_stock':
        return products.filter(p => p.stock <= p.minStock && p.stock > 0);
      case 'no_stock':
        return products.filter(p => p.stock <= 0);
      default:
        return products;
    }
  }, [products, productsFilter]);

  const topMovedProducts = useMemo(() => {
    const productStats = {};
    movements.forEach(movement => {
      if (!productStats[movement.productId]) {
        productStats[movement.productId] = {
          productId: movement.productId,
          productName: movement.product,
          totalMovements: 0,
          totalQuantity: 0,
          currentStock: products.find(p => p.id === movement.productId)?.stock || 0
        };
      }
      productStats[movement.productId].totalMovements++;
      productStats[movement.productId].totalQuantity += movement.quantity;
    });
    return Object.values(productStats).sort((a, b) => b.totalMovements - a.totalMovements);
  }, [movements, products]);

  const leastMovedProducts = useMemo(() => {
    const allProductIds = new Set(products.map(p => p.id));
    const movementProductIds = new Set(movements.map(m => m.productId));

    // Produtos que foram movidos alguma vez
    const movedProducts = products.map(product => {
      const productMovements = movements.filter(m => m.productId === product.id);
      return {
        productId: product.id,
        productName: product.name,
        totalMovements: productMovements.length,
        totalQuantity: productMovements.reduce((sum, m) => sum + m.quantity, 0),
        currentStock: product.stock
      };
    });

    // Produtos que NUNCA foram movidos
    const neverMovedProducts = products
      .filter(product => !movementProductIds.has(product.id))
      .map(product => ({
        productId: product.id,
        productName: product.name,
        totalMovements: 0,
        totalQuantity: 0,
        currentStock: product.stock
      }));

    // Combina e ordena
    const combinedProducts = [...movedProducts, ...neverMovedProducts];
    return combinedProducts.sort((a, b) => a.totalMovements - b.totalMovements);

  }, [movements, products]);

  // Gerar QR Code e etiquetas
  const generateQRCode = async (data, size = 200) => {
    try {
      // Codifica os dados do produto para a URL
      const qrData = encodeURIComponent(JSON.stringify({
        id: data.id,
        name: data.name,
        brand: data.brand || '',
        category: data.category,
        code: data.code,
        timestamp: new Date().toISOString()
      }));
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${qrData}&bgcolor=FFFFFF&color=000000&margin=10&format=png`;

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Necessário para obter os dados da imagem
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = qrUrl;
      });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      return null;
    }
  };

  // ✅ FUNÇÃO CORRIGIDA: Gerar etiquetas com finally
  const generateA4Label = async () => {
    if (!selectedProduct) {
      setErrors({ general: 'Selecione um produto' });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const currentLabelConfig = getProductLabelConfig(selectedProduct);
    setLoading(true);
    setErrors({});

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const dpi = 300; // Resolução para impressão de alta qualidade
      const ptToPx = dpi / 72; // Conversão de pontos para pixels
      const mmToPx = dpi / 25.4; // Conversão de milímetros para pixels

      // Define o tamanho do canvas A4 em pixels (210mm x 297mm)
      const a4WidthPx = 210 * mmToPx;
      const a4HeightPx = 297 * mmToPx;
      canvas.width = a4WidthPx;
      canvas.height = a4HeightPx;

      // Limpa o canvas com a cor de fundo da empresa se existir, ou branco
      ctx.fillStyle = companySettings.labelBackgroundColor || '#ffffff'; // Cor de fundo padrão ou da empresa
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let qrImage = null;
      if (currentLabelConfig.showQRCode) {
        const qrSizePx = currentLabelConfig.qrSize * mmToPx;
        qrImage = await generateQRCode(product, qrSizePx);
      }

      // Desenha as etiquetas na folha A4
      const labelWidthMm = currentLabelConfig.labelWidth || 85; // Largura da etiqueta em mm
      const labelHeightMm = currentLabelConfig.labelHeight || 60; // Altura da etiqueta em mm
      const labelWidthPx = labelWidthMm * mmToPx;
      const labelHeightPx = labelHeightMm * mmToPx;
      const marginA4Px = 10 * mmToPx; // Margem da folha A4

      const cols = Math.floor((a4WidthPx - 2 * marginA4Px) / labelWidthPx);
      const rows = Math.floor((a4HeightPx - 2 * marginA4Px) / labelHeightPx);

      let labelIndex = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (labelIndex >= 1) break; // Limita a geração para uma etiqueta por vez para teste, remover se quiser preencher a página

          const x = marginA4Px + c * labelWidthPx;
          const y = marginA4Px + r * labelHeightPx;

          // Desenha a etiqueta individual
          ctx.fillStyle = currentLabelConfig.backgroundColor;
          ctx.fillRect(x, y, labelWidthPx, labelHeightPx);

          if (currentLabelConfig.showBorder) {
            ctx.strokeStyle = currentLabelConfig.borderColor;
            ctx.lineWidth = 2; // Largura da borda em pixels
            ctx.strokeRect(x, y, labelWidthPx, labelHeightPx);
          }

          ctx.fillStyle = currentLabelConfig.textColor;
          const centerX = x + labelWidthPx / 2;
          const labelPaddingPx = 5 * mmToPx; // Padding interno da etiqueta

          let currentY = y + labelPaddingPx;

          // Desenha Marca
          if (currentLabelConfig.showBrand && product.brand) {
            const brandSizeCanvas = (currentLabelConfig.brandFontSize || 18) * ptToPx;
            ctx.font = `bold ${brandSizeCanvas}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(product.brand, centerX, currentY + brandSizeCanvas);
            currentY += brandSizeCanvas + (5 * mmToPx); // Espaçamento após a marca
          }

          // Desenha Código e Nome do Produto
          let productText = '';
          if (currentLabelConfig.showCode && currentLabelConfig.showDescription) {
            productText = `${product.code || ''} - ${product.name}`;
          } else if (currentLabelConfig.showCode) {
            productText = product.code || '';
          } else if (currentLabelConfig.showDescription) {
            productText = product.name;
          }

          if (productText) {
            const productBaseSizeCanvas = (currentLabelConfig.codeFontSize || 12) * ptToPx;
            ctx.font = `${productBaseSizeCanvas}px Arial`;
            ctx.textAlign = 'center';
            const maxWidth = labelWidthPx - (labelPaddingPx * 2);

            // Quebra de linha manual para o texto do produto
            const words = productText.split(' ');
            const lines = [];
            let currentLine = '';

            for (let i = 0; i < words.length; i++) {
              const testLine = currentLine + (currentLine ? ' ' : '') + words[i];
              const metrics = ctx.measureText(testLine);
              if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = words[i];
              } else {
                currentLine = testLine;
              }
            }
            if (currentLine !== '') {
              lines.push(currentLine);
            }

            // Limita a 2 linhas e desenha
            let lineHeight = productBaseSizeCanvas;
            const linesToDraw = lines.slice(0, 2);
            linesToDraw.forEach((line, index) => {
              ctx.fillText(line, centerX, currentY + lineHeight);
              currentY += lineHeight + (2 * mmToPx); // Pequeno espaçamento entre linhas
            });
            currentY += (4 * mmToPx); // Espaço após o texto do produto
          }

          // Desenha Quantidade
          if (currentLabelConfig.showQuantity) {
            const quantitySizeCanvas = (currentLabelConfig.quantityFontSize || 14) * ptToPx;
            ctx.font = `bold ${quantitySizeCanvas}px Arial`;
            ctx.textAlign = 'left';
            const quantityText = currentLabelConfig.customQuantity.trim() || `${product.stock}`;
            ctx.fillText(quantityText, x + labelPaddingPx, y + labelHeightPx - labelPaddingPx);
          }

          // Desenha QR Code
          if (currentLabelConfig.showQRCode && qrImage) {
            const qrSizeOnLabelPx = currentLabelConfig.qrSize * mmToPx;
            const qrX = x + labelWidthPx - labelPaddingPx - qrSizeOnLabelPx;
            const qrY = y + labelHeightPx - labelPaddingPx - qrSizeOnLabelPx;
            ctx.drawImage(qrImage, qrX, qrY, qrSizeOnLabelPx, qrSizeOnLabelPx);
          }

          labelIndex++;
        }
        if (labelIndex >= 1) break; // Sai do loop externo se já gerou uma etiqueta
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `etiquetas_${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.png`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png', 1.0); // Alta qualidade
      link.click();

      setSuccess(`✅ Etiquetas PNG geradas com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Erro ao gerar PNG:', error);
      setErrors({ general: 'Erro ao gerar etiquetas. Verifique as configurações.' });
      setTimeout(() => setErrors({}), 3000);
    } finally {
      setLoading(false); // ✅ SEMPRE executa
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* Toast notifications */}
      {success && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle size={20} /> {success}
        </div>
      )}
      {errors.general && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <AlertTriangle size={20} /> {errors.general}
        </div>
      )}
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="flex flex-col items-center text-white">
            <Loader2 className="animate-spin h-8 w-8 mb-3" />
            Processando...
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-blue-600">EstoqueFF</h1>
              <div className="hidden md:flex space-x-4">
                {[
                  { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
                  { id: 'scanner', icon: Scan, label: 'Movimentação' },
                  { id: 'products', icon: Package, label: 'Produtos' },
                  { id: 'labels', icon: QrCode, label: 'Etiquetas' },
                  { id: 'reports', icon: TrendingUp, label: 'Relatórios' },
                  { id: 'settings', icon: Settings, label: 'Config' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentScreen(item.id)}
                    className={`flex items-center py-2 px-3 rounded-lg transition-colors text-sm font-medium ${currentScreen === item.id ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <item.icon className="h-5 w-5 mr-1" /> {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="font-medium text-gray-800">{companySettings.responsibleName}</span>
                <span className="text-xs text-gray-500">{companySettings.companyName}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center text-white font-bold text-lg">
                {companySettings.responsibleName.split(' ').map(n => n?.[0]).join('')}
              </div>
            </div>
          </div>
        </div>
        {/* Mobile Navigation */}
        <div className="md:hidden flex justify-around py-3 px-2 border-t border-gray-200 bg-white sticky bottom-0 z-30">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'scanner', icon: Scan, label: 'Movimentação' },
            { id: 'products', icon: Package, label: 'Produtos' },
            { id: 'labels', icon: QrCode, label: 'Etiquetas' },
            { id: 'reports', icon: TrendingUp, label: 'Relatórios' },
            { id: 'settings', icon: Settings, label: 'Config' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${currentScreen === item.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs font-medium">{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Screen */}
        {currentScreen === 'dashboard' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow border border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Produtos</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.totalProducts}</p>
                </div>
                <Package className="h-10 w-10 text-blue-400" />
              </div>
              <div className="bg-white p-6 rounded-xl shadow border border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-500">Estoque Baixo</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.lowStockProducts}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-yellow-400" />
              </div>
              <div className="bg-white p-6 rounded-xl shadow border border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Itens</p>
                  <p className="text-3xl font-bold text-green-600">{stats.totalItems}</p>
                </div>
                <Package className="h-10 w-10 text-green-400" />
              </div>
              <div className="bg-white p-6 rounded-xl shadow border border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-500">Movimentações Hoje</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.todayMovements}</p>
                </div>
                <Scan className="h-10 w-10 text-purple-400" />
              </div>
            </div>

            {/* Alertas de Estoque Baixo */}
            {stats.lowStockProducts > 0 && (
              <div className="bg-white p-6 rounded-xl shadow border border-yellow-300 mt-8">
                <h3 className="text-xl font-bold text-yellow-700 mb-4">
                  <AlertTriangle className="inline-block mr-2 h-6 w-6" /> Produtos com Estoque Baixo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.filter(p => p.stock <= p.minStock).slice(0, 4).map(product => (
                    <div key={product.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded border border-yellow-200">
                      <div>
                        <p className="font-semibold text-gray-800">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.stock} / {product.minStock} unidades</p>
                      </div>
                      <button onClick={() => { setSelectedProduct(product.id); setCurrentScreen('scanner'); }} className="text-yellow-600 hover:text-yellow-800 font-medium text-sm px-3 py-1 rounded border border-yellow-300 hover:bg-yellow-100 transition-colors">
                        Repor
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Últimas Movimentações */}
            <div className="bg-white p-6 rounded-xl shadow border border-gray-200 mt-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                <Scan className="inline-block mr-2 h-6 w-6" /> Últimas Movimentações
              </h3>
              <ul className="space-y-3">
                {movements.slice(0, 5).map(movement => (
                  <li key={movement.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                    <div>
                      <p className={`font-semibold ${movement.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {movement.type === 'entrada' ? '+' : '-'} {movement.quantity} unidades
                      </p>
                      <p className="text-sm text-gray-600">Produto: {movement.product}</p>
                      <p className="text-xs text-gray-500 mt-1">{movement.user} • {movement.date}</p>
                    </div>
                    <button onClick={() => { setSelectedProduct(movement.productId); setCurrentScreen('products'); }} className="text-blue-600 hover:text-blue-800 font-medium text-sm px-3 py-1 rounded border border-blue-300 hover:bg-blue-100 transition-colors">
                      Ver Detalhes
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Scanner Screen - Sistema Completo */}
        {currentScreen === 'scanner' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">
              <Scan className="inline-block mr-2 h-8 w-8" /> Movimentação de Estoque
            </h2>

            {/* Botões de opção */}
            {!scannerActive && !scannedProduct && !showManualMovement && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <button onClick={startRealQRScanner} className="bg-blue-500 text-white p-6 rounded-lg hover:bg-blue-600 transition-colors flex flex-col items-center gap-3 shadow-md">
                  <Camera className="h-10 w-10" />
                  <span className="font-semibold text-lg">Scanner QR Code</span>
                  Use a câmera
                </button>
                <button onClick={() => { setShowManualMovement(true); setMovementType(''); }} className="bg-green-500 text-white p-6 rounded-lg hover:bg-green-600 transition-colors flex flex-col items-center gap-3 shadow-md">
                  <Search className="h-10 w-10" />
                  <span className="font-semibold text-lg">Busca Manual</span>
                  Pesquisar produto
                </button>
              </div>
            )}

            {/* Scanner Ativo */}
            {scannerActive && (
              <div className="relative w-full max-w-xl mx-auto aspect-video rounded-lg overflow-hidden border-4 border-blue-500 shadow-lg mb-6">
                {cameraStream ? (
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                ) : (
                  <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-white">
                    <Loader2 className="animate-spin h-8 w-8 mr-3" /> Carregando Câmera...
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-40 h-40 border-4 border-green-400 rounded-lg"></div>
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-white font-medium bg-black bg-opacity-50 px-4 py-2 rounded">
                  🔍 Posicione o QR Code dentro da área marcada
                  <br />
                  <span className="text-green-400">Aguarde a detecção automática...</span>
                </div>
                {/* Botão para parar o scanner */}
                <button 
                  onClick={stopCamera}
                  className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"
                  title="Parar Scanner"
                >
                  <X size={24} />
                </button>
              </div>
            )}

            {/* Movimentação Manual - Busca de Produto */}
            {showManualMovement && !manualSelectedProduct && (
              <div className="w-full max-w-xl mx-auto bg-white p-8 rounded-xl shadow border border-gray-200 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">Busca Manual de Produto</h3>
                  <button onClick={() => { setShowManualMovement(false); setManualSearchTerm(''); }} className="text-gray-500 hover:text-gray-700 transition-colors">
                    <X size={30} />
                  </button>
                </div>
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={manualSearchTerm}
                    onChange={handleManualSearchChange}
                    className="w-full pl-10 pr-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    style={{ fontSize: '16px' }}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="Pesquisar por nome, código ou marca..."
                  />
                </div>

                <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-md">
                  {products.filter(product => {
                    if (!manualSearchTerm.trim()) return true;
                    const term = manualSearchTerm.toLowerCase().trim();
                    return product.name.toLowerCase().includes(term) ||
                           (product.code && product.code.toLowerCase().includes(term)) ||
                           (product.brand && product.brand.toLowerCase().includes(term)) ||
                           product.category.toLowerCase().includes(term);
                  }).slice(0, 10).map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setManualSelectedProduct(product);
                      }}
                      className="w-full text-left px-4 py-3 border-b border-gray-100 bg-white hover:bg-gray-50 flex justify-between items-center"
                    >
                      <div>
                        <h4 className="font-semibold text-gray-800">{product.name}</h4>
                        <p className="text-sm text-gray-600">
                          {product.brand && `${product.brand} • `} Código: {product.code || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">Categoria: {product.category}</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-sm text-gray-700">Estoque:</span>
                        <span className="text-base font-bold text-gray-900">{product.stock} unid.</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Formulário de Movimentação (após scanner ou busca manual) */}
            {(scannedProduct || manualSelectedProduct) && (
              <div className="w-full max-w-xl mx-auto bg-white p-8 rounded-xl shadow border border-gray-200 mt-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">
                    {scannedProduct ? 'Produto Escaneado!' : 'Produto Selecionado!'}
                  </h3>
                  <button onClick={() => { setScannedProduct(null); setManualSelectedProduct(null); setShowManualMovement(false); setManualSearchTerm(''); setMovementType(''); setErrors({}); }} className="text-gray-500 hover:text-gray-700 transition-colors">
                    <X size={30} />
                  </button>
                </div>

                <div className="mb-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-xl font-semibold text-gray-800">{(scannedProduct || manualSelectedProduct).name}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Código: {(scannedProduct || manualSelectedProduct).code || '-'} • Marca: {(scannedProduct || manualSelectedProduct).brand || '-'} • Categoria: {(scannedProduct || manualSelectedProduct).category}
                  </p>
                  <p className="text-lg font-bold text-blue-600 mt-2">
                    Estoque Atual: {(scannedProduct || manualSelectedProduct).stock} unidades
                  </p>
                </div>

                {/* Mensagens de erro específicas */}
                {(errors.quantity || errors.movement) && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
                    {errors.quantity && <p className="mb-1">⚠️ {errors.quantity}</p>}
                    {errors.movement && <p>⚠️ {errors.movement}</p>}
                  </div>
                )}

                {/* Botões de Tipo de Movimentação */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => { setMovementType('entrada'); if (errors.movement) setErrors({ ...errors, movement: '' }); }}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors border-2
                      ${movementType === 'entrada' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50'}`}
                  >
                    <Upload className="inline-block mr-2 h-5 w-5" /> Entrada
                  </button>
                  <button
                    onClick={() => { setMovementType('saída'); if (errors.movement) setErrors({ ...errors, movement: '' }); }}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors border-2
                      ${movementType === 'saída' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-700 border-gray-300 hover:border-red-400 hover:bg-red-50'}`}
                  >
                    <Download className="inline-block mr-2 h-5 w-5" /> Saída
                  </button>
                </div>

                {/* Campo de Quantidade */}
                <div className="mb-6">
                  <label htmlFor="movementQuantity" className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="movementQuantity"
                    type="number"
                    value={movementQuantity}
                    onChange={(e) => {
                      setMovementQuantity(e.target.value);
                      if (errors.quantity) setErrors({ ...errors, quantity: '' });
                    }}
                    className={`w-full px-4 py-4 border rounded-lg focus:ring-2 focus:border-blue-500
                      ${errors.quantity ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    style={{ fontSize: '16px' }}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="Digite a quantidade"
                    min="1"
                  />
                  {errors.quantity && <p className="text-red-500 text-sm mt-1">{errors.quantity}</p>}
                </div>

                {/* Botões de Confirmação e Cancelamento */}
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setScannedProduct(null);
                      setManualSelectedProduct(null);
                      setShowManualMovement(false);
                      setManualSearchTerm('');
                      setMovementType('');
                      setMovementQuantity(1);
                      setErrors({});
                    }}
                    className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => processMovement(scannedProduct || manualSelectedProduct)}
                    disabled={loading || !movementType || !movementQuantity || isNaN(parseInt(movementQuantity)) || parseInt(movementQuantity) <= 0}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
                      ${(!movementType || !movementQuantity || isNaN(parseInt(movementQuantity)) || parseInt(movementQuantity) <= 0)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : loading
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                  >
                    {loading ? (
                      <>Processando...</>
                    ) : (
                      <>Confirmar Movimentação</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Products Screen */}
        {currentScreen === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">
                <Package className="inline-block mr-2 h-8 w-8" /> Gestão de Produtos
              </h2>
              <button onClick={() => { setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 }); setShowAddProduct(true); }} className="bg-blue-500 text-white px-5 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-md font-medium">
                <Plus className="h-5 w-5" /> Novo Produto
              </button>
            </div>
            <div className="mb-6">
              <ProductSearch searchTerm={searchTerm} onSearchChange={handleSearchChange} />
            </div>
            <ProductList products={products} searchTerm={searchTerm} onEdit={handleEditProduct} onDelete={handleDeleteProduct} />
          </div>
        )}

        {/* Labels Screen - Gerador de Etiquetas */}
        {currentScreen === 'labels' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">
              <QrCode className="inline-block mr-2 h-8 w-8" /> Gerador de Etiquetas
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* Seleção de Produto */}
              <div className="lg:col-span-1 bg-white p-8 rounded-xl shadow border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Selecionar Produto para Etiquetas</h3>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={labelSearchTerm}
                    onChange={(e) => handleLabelSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Pesquisar produto..."
                  />
                </div>

                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md pr-2">
                  {products.filter(product => {
                    if (!labelSearchTerm.trim()) return true;
                    const term = labelSearchTerm.toLowerCase().trim();
                    return product.name.toLowerCase().includes(term) ||
                           product.id.toLowerCase().includes(term) ||
                           (product.brand && product.brand.toLowerCase().includes(term)) ||
                           product.category.toLowerCase().includes(term) ||
                           (product.code && product.code.toLowerCase().includes(term));
                  }).map(product => (
                    <div key={product.id} className="flex items-center justify-between py-3 px-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-gray-800">{product.name}</p>
                        <p className="text-xs text-gray-500">
                          {product.brand || 'Sem marca'} • Código: {product.code || 'N/A'} • Estoque: {product.stock}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedProduct(product.id)}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors
                            ${selectedProduct === product.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {selectedProduct === product.id ? '✓ Selecionado' : 'Selecionar'}
                        </button>
                        <button onClick={() => openLabelEditorForProduct(product.id)} className="p-2 bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors" title="Configurar etiqueta">
                          <Settings size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Geração e Preview */}
              <div className="lg:col-span-2 bg-white p-8 rounded-xl shadow border border-gray-200">
                {!selectedProduct && (
                  <div className="flex flex-col items-center justify-center h-full">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">Selecione um Produto</h3>
                    <p className="text-gray-500">Escolha um produto na lista à esquerda para configurar e gerar suas etiquetas com QR Code.</p>
                  </div>
                )}

                {selectedProduct && (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-gray-800">
                        Configuração e Preview para: {products.find(p => p.id === selectedProduct)?.name}
                      </h3>
                      <button onClick={() => openLabelEditorForProduct(selectedProduct)} className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 font-medium shadow-md">
                        <Settings size={20} className="mr-1"/> Configurar Etiqueta
                      </button>
                    </div>

                    <div className="flex justify-center items-center mb-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
                      <LabelPreview product={products.find(p => p.id === selectedProduct)} labelTemplate={getProductLabelConfig(selectedProduct)} companySettings={companySettings} />
                    </div>
                    <p className="text-sm text-center text-gray-500 mb-6">
                      * Esta é uma prévia da etiqueta que será gerada em formato PNG. Você pode configurar os elementos e tamanhos na seção "Configurar Etiqueta".
                    </p>

                    <div className="flex justify-center">
                      <button onClick={generateA4Label} disabled={loading} className={`bg-blue-500 text-white px-10 py-4 rounded-lg hover:bg-blue-600 transition-colors font-bold text-lg flex items-center gap-3 shadow-md
                        ${loading ? 'bg-blue-400 cursor-not-allowed' : ''}`}>
                        {loading ? (
                          <>Gerando...</>
                        ) : (
                          <>Gerar Etiquetas A4 (PNG)</>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reports Screen - Relatórios Completos */}
        {currentScreen === 'reports' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">
                <TrendingUp className="inline-block mr-2 h-8 w-8" /> Relatórios
              </h2>
              <div className="flex gap-4">
                <button onClick={createBackup} className="bg-blue-500 text-white px-5 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-md font-medium">
                  <Upload className="h-5 w-5" /> Backup
                </button>
                <label className="cursor-pointer bg-green-500 text-white px-5 py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 shadow-md font-medium">
                  <Download className="h-5 w-5" /> Restaurar
                  <input type="file" accept=".json" onChange={restoreBackup} className="hidden" />
                </label>
              </div>
            </div>

            {/* Abas de relatórios */}
            <div className="flex space-x-6 border-b-2 border-gray-200 mb-6 px-2">
              <button
                onClick={() => setReportsTab('movements')}
                className={`py-3 px-4 font-medium border-b-2 ${reportsTab === 'movements' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Movimentações
              </button>
              <button
                onClick={() => setReportsTab('products')}
                className={`py-3 px-4 font-medium border-b-2 ${reportsTab === 'products' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Produtos
              </button>
              <button
                onClick={() => setReportsTab('analytics')}
                className={`py-3 px-4 font-medium border-b-2 ${reportsTab === 'analytics' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Análises
              </button>
            </div>

            {/* Relatório de Movimentações */}
            {reportsTab === 'movements' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Relatório de Movimentações</h3>
                <div className="flex flex-wrap gap-4 mb-6">
                  <label className="flex items-center gap-2">
                    Período:
                    <select value={movementsPeriodFilter} onChange={(e) => setMovementsPeriodFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
                      <option value="all">Todas</option>
                      <option value="7days">Últimos 7 dias</option>
                      <option value="30days">Últimos 30 dias</option>
                    </select>
                  </label>
                  <button onClick={() => exportData('movements', 'excel')} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 text-sm shadow-md">
                    <FileSpreadsheet className="h-5 w-5" /> Excel
                  </button>
                  <button onClick={() => exportData('movements', 'pdf')} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 text-sm shadow-md">
                    <FileText className="h-5 w-5" /> PDF
                  </button>
                </div>
                <div className="bg-white shadow border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredMovements.map(movement => (
                        <tr key={movement.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{movement.product}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{movement.user}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{movement.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${movement.type === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {movement.type === 'entrada' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                            {movement.type === 'entrada' ? '+' : '-'} {movement.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredMovements.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Nenhuma movimentação encontrada para o período selecionado.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Relatório de Produtos */}
            {reportsTab === 'products' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Relatório de Produtos</h3>
                <div className="flex flex-wrap gap-4 mb-6">
                  <label className="flex items-center gap-2">
                    Filtro:
                    <select value={productsFilter} onChange={(e) => setProductsFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
                      <option value="all">Todos</option>
                      <option value="low_stock">Estoque Baixo</option>
                      <option value="no_stock">Sem Estoque</option>
                    </select>
                  </label>
                  <button onClick={() => exportData('products', 'excel')} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 text-sm shadow-md">
                    <FileSpreadsheet className="h-5 w-5" /> Excel
                  </button>
                  <button onClick={() => exportData('products', 'pdf')} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 text-sm shadow-md">
                    <FileText className="h-5 w-5" /> PDF
                  </button>
                </div>
                <div className="bg-white shadow border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Min.</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredProducts.map(product => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.brand || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.code || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{product.stock}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{product.minStock}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${product.stock <= 0 ? 'bg-red-100 text-red-800' : product.stock <= product.minStock ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                              {product.stock <= 0 ? 'Sem Estoque' : product.stock <= product.minStock ? 'Estoque Baixo' : 'Normal'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredProducts.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Nenhum produto encontrado com os filtros selecionados.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Análises */}
            {reportsTab === 'analytics' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-6">Análises e Estatísticas</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Produtos Mais Movimentados */}
                  <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                    <h4 className="text-xl font-bold text-gray-800 mb-4">🔥 Produtos Mais Movimentados</h4>
                    <div className="space-y-3">
                      {topMovedProducts.slice(0, 10).map((product, index) => (
                        <div key={product.productId} className="flex justify-between items-center p-3 bg-blue-50 rounded border">
                          <div>
                            <span className="font-medium text-gray-800">#{index + 1} {product.productName}</span>
                            <p className="text-sm text-gray-600">Estoque atual: {product.currentStock}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600">{product.totalMovements} movim.</p>
                            <p className="text-sm text-gray-600">{product.totalQuantity} itens</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Produtos Menos Movimentados */}
                  <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                    <h4 className="text-xl font-bold text-gray-800 mb-4">🐌 Produtos Menos Movimentados</h4>
                    <div className="space-y-3">
                      {leastMovedProducts.slice(0, 10).map((product, index) => (
                        <div key={product.productId} className="flex justify-between items-center p-3 bg-orange-50 rounded border">
                          <div>
                            <span className="font-medium text-gray-800">{product.productName}</span>
                            <p className="text-sm text-gray-600">Estoque atual: {product.currentStock}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${product.totalMovements === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                              {product.totalMovements === 0 ? 'Nunca movido' : `${product.totalMovements} movim.`}
                            </p>
                            <p className="text-sm text-gray-600">{product.totalQuantity} itens</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Screen */}
        {currentScreen === 'settings' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">
              <Settings className="inline-block mr-2 h-8 w-8" /> Configurações
            </h2>
            <div className="bg-white p-8 rounded-xl shadow border border-gray-200 max-w-2xl">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Informações da Empresa</h3>
              <div className="space-y-6">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa</label>
                  <input
                    id="companyName"
                    type="text"
                    value={companySettings.companyName}
                    onChange={(e) => setCompanySettings({ ...companySettings, companyName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ fontSize: '16px' }}
                    placeholder="Digite o nome da sua empresa"
                  />
                </div>
                <div>
                  <label htmlFor="responsibleName" className="block text-sm font-medium text-gray-700 mb-2">Responsável</label>
                  <input
                    id="responsibleName"
                    type="text"
                    value={companySettings.responsibleName}
                    onChange={(e) => setCompanySettings({ ...companySettings, responsibleName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ fontSize: '16px' }}
                    placeholder="Digite o nome do responsável"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    id="lowStockAlert"
                    type="checkbox"
                    checked={companySettings.lowStockAlert}
                    onChange={(e) => setCompanySettings({ ...companySettings, lowStockAlert: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="lowStockAlert" className="ml-3 text-gray-700">
                    Alertas de estoque baixo no dashboard
                  </label>
                </div>
                <button
                  onClick={() => {
                    setSuccess('✅ Configurações salvas com sucesso!');
                    setTimeout(() => setSuccess(''), 3000);
                  }}
                  className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Salvar Configurações
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal - Adicionar Produto */}
        {showAddProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Novo Produto</h2>
                <button onClick={() => { setShowAddProduct(false); setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 }); setErrors({}); }} className="text-gray-500 hover:text-gray-700 transition-colors">
                  <X size={30} />
                </button>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-2">Nome do Produto <span className="text-red-500">*</span></label>
                    <input
                      id="productName"
                      type="text"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                      placeholder="Ex: Notebook Dell Inspiron"
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="productBrand" className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                    <input
                      id="productBrand"
                      type="text"
                      value={newProduct.brand}
                      onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      style={{ fontSize: '16px' }}
                      placeholder="Ex: Dell, Samsung, Apple"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="productCategory" className="block text-sm font-medium text-gray-700 mb-2">Categoria <span className="text-red-500">*</span></label>
                    <input
                      id="productCategory"
                      type="text"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.category ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                      placeholder="Ex: Eletrônicos, Acessórios"
                    />
                    {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
                  </div>
                  <div>
                    <label htmlFor="productCode" className="block text-sm font-medium text-gray-700 mb-2">Código <span className="text-red-500">*</span></label>
                    <input
                      id="productCode"
                      type="text"
                      value={newProduct.code}
                      onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.code ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                      placeholder="Ex: NB-DELL-001"
                    />
                    {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="productStock" className="block text-sm font-medium text-gray-700 mb-2">Estoque Inicial <span className="text-red-500">*</span></label>
                    <input
                      id="productStock"
                      type="number"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.stock ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                      placeholder="0"
                      min="0"
                    />
                    {errors.stock && <p className="text-red-500 text-sm mt-1">{errors.stock}</p>}
                  </div>
                  <div>
                    <label htmlFor="productMinStock" className="block text-sm font-medium text-gray-700 mb-2">Estoque Mínimo <span className="text-red-500">*</span></label>
                    <input
                      id="productMinStock"
                      type="number"
                      value={newProduct.minStock}
                      onChange={(e) => setNewProduct({ ...newProduct, minStock: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.minStock ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                      placeholder="1"
                      min="1"
                    />
                    {errors.minStock && <p className="text-red-500 text-sm mt-1">{errors.minStock}</p>}
                  </div>
                </div>
                <div className="flex space-x-4 pt-6">
                  <button
                    onClick={() => { setShowAddProduct(false); setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 }); setErrors({}); }}
                    className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addProduct}
                    disabled={loading}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                  >
                    {loading ? (
                      <> Salvando...
                    ) : (
                      <> Salvar Produto
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal - Editar Produto */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Editar Produto</h2>
                <button onClick={() => { setEditingProduct(null); setErrors({}); }} className="text-gray-500 hover:text-gray-700 transition-colors">
                  <X size={30} />
                </button>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="editProductName" className="block text-sm font-medium text-gray-700 mb-2">Nome do Produto <span className="text-red-500">*</span></label>
                    <input
                      id="editProductName"
                      type="text"
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="editProductBrand" className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                    <input
                      id="editProductBrand"
                      type="text"
                      value={editingProduct.brand || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="editProductCategory" className="block text-sm font-medium text-gray-700 mb-2">Categoria <span className="text-red-500">*</span></label>
                    <input
                      id="editProductCategory"
                      type="text"
                      value={editingProduct.category}
                      onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.category ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                    />
                    {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
                  </div>
                  <div>
                    <label htmlFor="editProductCode" className="block text-sm font-medium text-gray-700 mb-2">Código <span className="text-red-500">*</span></label>
                    <input
                      id="editProductCode"
                      type="text"
                      value={editingProduct.code || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.code ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                    />
                    {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="editProductStock" className="block text-sm font-medium text-gray-700 mb-2">Estoque Atual <span className="text-red-500">*</span></label>
                    <input
                      id="editProductStock"
                      type="number"
                      value={editingProduct.stock}
                      onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.stock ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                      min="0"
                    />
                    {errors.stock && <p className="text-red-500 text-sm mt-1">{errors.stock}</p>}
                  </div>
                  <div>
                    <label htmlFor="editProductMinStock" className="block text-sm font-medium text-gray-700 mb-2">Estoque Mínimo <span className="text-red-500">*</span></label>
                    <input
                      id="editProductMinStock"
                      type="number"
                      value={editingProduct.minStock}
                      onChange={(e) => setEditingProduct({ ...editingProduct, minStock: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.minStock ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      style={{ fontSize: '16px' }}
                      min="1"
                    />
                    {errors.minStock && <p className="text-red-500 text-sm mt-1">{errors.minStock}</p>}
                  </div>
                </div>
                <div className="flex space-x-4 pt-6">
                  <button
                    onClick={() => { setEditingProduct(null); setErrors({}); }}
                    className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={updateProduct}
                    disabled={loading}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                  >
                    {loading ? (
                      <> Salvando...
                    ) : (
                      <> Salvar Alterações
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal - Editor de Etiquetas */}
        {showLabelEditor && editingLabelForProduct && (
          <LabelEditor
            productId={editingLabelForProduct}
            product={products.find(p => p.id === editingLabelForProduct)}
            currentConfig={getProductLabelConfig(editingLabelForProduct)}
            onConfigUpdate={updateProductLabelConfig}
            onClose={closeLabelEditor}
            companySettings={companySettings}
          />
        )}
      </main>
    </div>
  );
};

export default EstoqueFFApp;
