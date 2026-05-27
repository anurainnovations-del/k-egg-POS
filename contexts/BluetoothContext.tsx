'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Web Bluetooth API type declarations
declare global {
  interface Navigator {
    bluetooth?: Bluetooth;
  }
  
  interface Bluetooth {
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
    getDevices?(): Promise<BluetoothDevice[]>;
  }
  
  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
    addEventListener(type: 'gattserverdisconnected', listener: (event: Event) => void): void;
    removeEventListener(type: 'gattserverdisconnected', listener: (event: Event) => void): void;
  }
  
  interface BluetoothRemoteGATTServer {
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
  }
  
  interface BluetoothRemoteGATTService {
    uuid: string;
    getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  }
  
  interface BluetoothRemoteGATTCharacteristic {
    uuid: string;
    properties: {
      write: boolean;
      writeWithoutResponse: boolean;
    };
    writeValue(value: ArrayBuffer | ArrayBufferView): Promise<void>;
    writeValueWithoutResponse(value: ArrayBuffer | ArrayBufferView): Promise<void>;
  }
  
  interface RequestDeviceOptions {
    acceptAllDevices?: boolean;
    optionalServices?: string[];
  }
}

interface BluetoothContextType {
  bluetoothDevice: BluetoothDevice | null;
  bluetoothStatus: string;
  isConnecting: boolean;
  connectToBluetoothPrinter: () => Promise<void>;
  disconnectPrinter: () => void;
  testPrint: () => Promise<void>;
  printReceipt: (receiptData: Uint8Array, orderData?: any) => Promise<boolean>;
  openCashDrawer: () => Promise<boolean>;
  printerType: 'bluetooth' | 'web_print';
  setPrinterType: (type: 'bluetooth' | 'web_print') => void;
  paperWidth: '58mm' | '80mm';
  setPaperWidth: (width: '58mm' | '80mm') => void;
  isBluetoothSupported: boolean;
}

const BluetoothContext = createContext<BluetoothContextType | undefined>(undefined);

export const useBluetoothPrinter = () => {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error('useBluetoothPrinter must be used within a BluetoothProvider');
  }
  return context;
};

interface BluetoothProviderProps {
  children: ReactNode;
}

const generateReceiptHtml = (order: any, paperWidth: '58mm' | '80mm') => {
  const formatCurrencyLocal = (num: number) => {
    return '₱' + num.toFixed(2);
  };

  const itemsHtml = (order.items || []).map((item: any) => `
    <tr>
      <td style="padding: 3px 0; vertical-align: top; font-weight: bold; width: 8%;">${item.qty}x</td>
      <td style="padding: 3px 0; vertical-align: top; width: 62%;">${item.name}</td>
      <td style="padding: 3px 0; vertical-align: top; text-align: right; width: 30%;">${formatCurrencyLocal(item.total || (item.price * item.qty))}</td>
    </tr>
  `).join('');

  const discountRow = order.discount && order.discount > 0 ? `
    <tr>
      <td colspan="2" style="padding: 2px 0;">Discount ${order.appliedDiscountCode ? `(${order.appliedDiscountCode})` : ''}</td>
      <td style="padding: 2px 0; text-align: right; color: #000;">-${formatCurrencyLocal(order.discount)}</td>
    </tr>
  ` : '';

  const logoUrl = "/K%20Egg%20Logo_Korean.png";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${order.orderId || 'Test'}</title>
      <style>
        @media print {
          @page {
            margin: 0;
            size: ${paperWidth === '58mm' ? '58mm' : '80mm'} auto;
          }
          body {
            margin: 0;
            padding: 2mm 1mm;
          }
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: ${paperWidth === '58mm' ? '12px' : '14px'};
          line-height: 1.3;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 10px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt-container {
          max-width: ${paperWidth === '58mm' ? '54mm' : '76mm'};
          margin: 0 auto;
        }
        .text-center {
          text-align: center;
        }
        .text-right {
          text-align: right;
        }
        .bold {
          font-weight: bold;
        }
        .logo {
          max-width: 90px;
          height: auto;
          display: block;
          margin: 0 auto 5px auto;
          filter: grayscale(100%);
        }
        .store-name {
          font-size: ${paperWidth === '58mm' ? '18px' : '22px'};
          font-weight: bold;
          margin: 5px 0 2px 0;
        }
        .branch-name {
          font-size: ${paperWidth === '58mm' ? '12px' : '14px'};
          margin-bottom: 8px;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        .item-table {
          width: 100%;
          border-collapse: collapse;
          margin: 5px 0;
        }
        .totals-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 5px;
        }
        .totals-table td {
          font-size: ${paperWidth === '58mm' ? '12px' : '14px'};
        }
        .grand-total {
          font-size: ${paperWidth === '58mm' ? '15px' : '18px'};
          font-weight: bold;
        }
        .footer {
          margin-top: 15px;
          font-size: ${paperWidth === '58mm' ? '11px' : '13px'};
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="text-center">
          <img src="${logoUrl}" class="logo" alt="K-Egg Logo" onerror="this.style.display='none'" />
          <div class="store-name">${order.storeName || 'K-EGG'}</div>
          <div class="branch-name">${order.branchName || 'Main Branch'}</div>
        </div>
        
        <div>
          <div>Order #: <span class="bold">${(order.orderId || '').slice(-8).toUpperCase()}</span></div>
          <div>Date: ${order.date ? new Date(order.date).toLocaleString() : new Date().toLocaleString()}</div>
          ${order.cashier ? `<div>Cashier: ${order.cashier}</div>` : ''}
        </div>
        
        <div class="divider"></div>
        
        <table class="item-table">
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <table class="totals-table">
          <tbody>
            <tr>
              <td colspan="2" style="padding: 2px 0;">Subtotal</td>
              <td style="padding: 2px 0; text-align: right;">${formatCurrencyLocal(order.subtotal || 0)}</td>
            </tr>
            ${discountRow}
            <tr class="grand-total">
              <td colspan="2" style="padding: 4px 0; border-top: 1px dashed #000;">TOTAL</td>
              <td style="padding: 4px 0; text-align: right; border-top: 1px dashed #000;">${formatCurrencyLocal(order.total || 0)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 2px 0; padding-top: 4px;">Payment</td>
              <td style="padding: 2px 0; padding-top: 4px; text-align: right;">${formatCurrencyLocal(order.payment || 0)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 2px 0;">Change</td>
              <td style="padding: 2px 0; text-align: right; font-weight: bold;">${formatCurrencyLocal(order.change || 0)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <div class="text-center footer">
          <div class="bold">Thank you for your order!</div>
          <div>Come back soon!</div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const BluetoothProvider: React.FC<BluetoothProviderProps> = ({ children }) => {
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null);
  const [bluetoothStatus, setBluetoothStatus] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [printerType, setPrinterTypeState] = useState<'bluetooth' | 'web_print'>('bluetooth');
  const [paperWidth, setPaperWidthState] = useState<'58mm' | '80mm'>('58mm');

  // Load saved printer settings on startup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedType = localStorage.getItem('printerType') as 'bluetooth' | 'web_print';
      if (savedType === 'bluetooth' || savedType === 'web_print') {
        setPrinterTypeState(savedType);
      } else if (!navigator.bluetooth) {
        // If bluetooth is not supported, default to web_print
        setPrinterTypeState('web_print');
      }
      
      const savedWidth = localStorage.getItem('paperWidth') as '58mm' | '80mm';
      if (savedWidth === '58mm' || savedWidth === '80mm') {
        setPaperWidthState(savedWidth);
      }
    }
  }, []);

  const setPrinterType = (type: 'bluetooth' | 'web_print') => {
    setPrinterTypeState(type);
    localStorage.setItem('printerType', type);
  };

  const setPaperWidth = (width: '58mm' | '80mm') => {
    setPaperWidthState(width);
    localStorage.setItem('paperWidth', width);
  };

  const isBluetoothSupported = typeof navigator !== 'undefined' && !!navigator.bluetooth;

  const setupBluetoothDevice = async (device: BluetoothDevice) => {
    console.log('Setting up device:', {
      id: device.id,
      name: device.name,
      gatt: !!device.gatt
    });

    setBluetoothDevice(device);
    
    // Store printer in localStorage for persistence
    localStorage.setItem('connectedPrinter', JSON.stringify({
      id: device.id,
      name: device.name || 'Unknown Printer'
    }));

    setBluetoothStatus(`Connected to: ${device.name || 'Unknown Printer'} - Ready for printing`);
  };

  const tryAutoReconnect = async () => {
    if (!navigator.bluetooth || !navigator.bluetooth.getDevices) return;
    
    const savedPrinter = localStorage.getItem('connectedPrinter');
    if (!savedPrinter) return;

    let printerInfo;
    try {
      printerInfo = JSON.parse(savedPrinter);
    } catch (parseError) {
      console.error('Failed to parse saved printer info:', parseError);
      localStorage.removeItem('connectedPrinter');
      return;
    }

    try {
      setBluetoothStatus(`Attempting to reconnect to ${printerInfo.name}...`);
      
      const devices = await navigator.bluetooth.getDevices();
      const savedDevice = devices.find((device: BluetoothDevice) => device.id === printerInfo.id);
      
      if (savedDevice && savedDevice.gatt) {
        try {
          await savedDevice.gatt.connect();
          await setupBluetoothDevice(savedDevice);
          console.log('Auto-reconnected to saved printer');
        } catch (connectError) {
          console.log('Auto-reconnect failed:', connectError);
          setBluetoothStatus(`${printerInfo.name} found but connection failed. Click to reconnect.`);
        }
      } else {
        setBluetoothStatus(`${printerInfo.name} not available. Click to reconnect.`);
      }
    } catch (error) {
      console.log('Auto-reconnect error:', error);
      setBluetoothStatus(`Bluetooth reconnect failed. Click to reconnect.`);
    }
  };

  const connectToBluetoothPrinter = async () => {
    if (!navigator.bluetooth) {
      setBluetoothStatus('Bluetooth not supported in this browser');
      return;
    }

    setIsConnecting(true);
    setBluetoothStatus('Scanning for Bluetooth printers...');

    try {
      const device = await navigator.bluetooth.requestDevice({
        optionalServices: [
          '00001101-0000-1000-8000-00805f9b34fb',
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ff00-0000-1000-8000-00805f9b34fb', 
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          '0000fff0-0000-1000-8000-00805f9b34fb',
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
        ],
        acceptAllDevices: true
      });

      await setupBluetoothDevice(device);
      
    } catch (error: any) {
      console.error('Bluetooth connection error:', error);
      setBluetoothStatus(`Connection failed: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectPrinter = () => {
    if (bluetoothDevice) {
      if (bluetoothDevice.gatt?.connected) {
        bluetoothDevice.gatt.disconnect();
      }
    }
    setBluetoothDevice(null);
    localStorage.removeItem('connectedPrinter');
    setBluetoothStatus('Disconnected');
  };

  const testPrint = async () => {
    if (printerType === 'web_print') {
      const mockOrder = {
        orderId: "TEST-123456",
        date: new Date(),
        items: [
          { name: "K-Egg Classic Special", qty: 2, price: 150, total: 300 },
          { name: "Korean Iced Coffee", qty: 1, price: 90, total: 90 }
        ],
        subtotal: 390,
        discount: 30,
        appliedDiscountCode: "WELCOME10",
        total: 360,
        payment: 500,
        change: 140,
        cashier: "Test Cashier",
        storeName: "K-Egg POS",
        branchName: "Main Branch"
      };
      setBluetoothStatus('Opening system print dialog...');
      const success = await printReceipt(new Uint8Array(), mockOrder);
      if (success) {
        setBluetoothStatus('Test print dialog opened successfully!');
      } else {
        setBluetoothStatus('Failed to open test print dialog.');
      }
      return;
    }

    if (!bluetoothDevice) {
      setBluetoothStatus('No printer connected');
      return;
    }

    try {
      setBluetoothStatus('Connecting to printer...');
      const server = await bluetoothDevice.gatt!.connect();
      
      setBluetoothStatus('Getting services...');
      const services = await server.getPrimaryServices();
      
      console.log('Available services:', services.map(s => s.uuid));
      
      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
      
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          console.log(`Service ${service.uuid} characteristics:`, 
            characteristics.map(c => ({ uuid: c.uuid, properties: c.properties })));
          
          const writableChar = characteristics.find(c => 
            c.properties.write || c.properties.writeWithoutResponse
          );
          
          if (writableChar) {
            characteristic = writableChar;
            console.log('Found writable characteristic:', writableChar.uuid);
            break;
          }
        } catch (error) {
          console.log(`Error getting characteristics for service ${service.uuid}:`, error);
        }
      }
      
      if (!characteristic) {
        setBluetoothStatus('No writable characteristic found');
        return;
      }
      
      const escPos = [
        0x1B, 0x40,
        0x1B, 0x61, 0x01,
        0x1B, 0x21, 0x30,
        ...Array.from(new TextEncoder().encode('K-EGG POS\n')),
        0x1B, 0x21, 0x00,
        0x1B, 0x61, 0x00,
        ...Array.from(new TextEncoder().encode('\n')),
        ...Array.from(new TextEncoder().encode('Test Receipt\n')),
        ...Array.from(new TextEncoder().encode('Date: ' + new Date().toLocaleString() + '\n')),
        ...Array.from(new TextEncoder().encode('\n')),
        ...Array.from(new TextEncoder().encode('Bluetooth connection successful!\n')),
        ...Array.from(new TextEncoder().encode('\n')),
        0x1B, 0x61, 0x01,
        ...Array.from(new TextEncoder().encode('Thank you!\n')),
        ...Array.from(new TextEncoder().encode('\n\n\n')),
        0x1D, 0x56, 0x00
      ];
      
      const data = new Uint8Array(escPos);
      setBluetoothStatus('Printing...');
      
      const chunkSize = 100; // Safer chunk size for cheap 58mm printer buffers
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        try {
          if (characteristic.properties.writeWithoutResponse) {
            try {
              await characteristic.writeValueWithoutResponse(chunk);
            } catch (writeWithoutRespErr) {
              console.warn('writeValueWithoutResponse failed, falling back to writeValue:', writeWithoutRespErr);
              await characteristic.writeValue(chunk);
            }
          } else {
            await characteristic.writeValue(chunk);
          }
          
          await new Promise(resolve => setTimeout(resolve, 30));
        } catch (writeError: any) {
          console.error('Write error:', writeError);
          setBluetoothStatus(`Print error: ${writeError.message}`);
          return;
        }
      }
      
      setBluetoothStatus('Test print sent successfully!');
      
    } catch (error: any) {
      console.error('Test print error:', error);
      setBluetoothStatus(`Test print failed: ${error.message}`);
    }
  };

  const printReceipt = async (receiptData: Uint8Array, orderData?: any): Promise<boolean> => {
    if (printerType === 'web_print') {
      try {
        console.log('Printing via System Print (AirPrint)...');
        const data = orderData || {
          orderId: "MOCK-RECEIPT",
          date: new Date(),
          items: [
            { name: "Print Fallback Item", qty: 1, price: 100, total: 100 }
          ],
          subtotal: 100,
          total: 100,
          payment: 100,
          change: 0,
          storeName: "K-EGG",
          branchName: "System Print"
        };
        const html = generateReceiptHtml(data, paperWidth);
        
        // Print via hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();

          // Wait a small moment to ensure rendering/styles are loaded
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              resolve();
            }, 250);
          });

          // Clean up
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
          
          return true;
        }
        return false;
      } catch (err) {
        console.error('System print error:', err);
        return false;
      }
    }

    if (!bluetoothDevice) {
      console.error('No printer connected');
      return false;
    }

    try {
      console.log('Connecting to printer for receipt...');
      const server = await bluetoothDevice.gatt!.connect();
      
      console.log('Getting services...');
      const services = await server.getPrimaryServices();
      
      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
      
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          
          const writableChar = characteristics.find(c => 
            c.properties.write || c.properties.writeWithoutResponse
          );
          
          if (writableChar) {
            characteristic = writableChar;
            console.log('Found writable characteristic for receipt:', writableChar.uuid);
            break;
          }
        } catch (error) {
          console.log(`Error getting characteristics for service ${service.uuid}:`, error);
        }
      }
      
      if (!characteristic) {
        console.error('No writable characteristic found for receipt');
        return false;
      }
      
      console.log('Printing receipt...');
      const chunkSize = 100; // Safer chunk size for cheap 58mm printer buffers
      for (let i = 0; i < receiptData.length; i += chunkSize) {
        const chunk = receiptData.slice(i, i + chunkSize);
        
        try {
          if (characteristic.properties.writeWithoutResponse) {
            try {
              await characteristic.writeValueWithoutResponse(chunk);
            } catch (writeWithoutRespErr) {
              console.warn('writeValueWithoutResponse failed, falling back to writeValue:', writeWithoutRespErr);
              await characteristic.writeValue(chunk);
            }
          } else {
            await characteristic.writeValue(chunk);
          }
          
          await new Promise(resolve => setTimeout(resolve, 30));
        } catch (writeError: any) {
          console.error('Write error during receipt print:', writeError);
          return false;
        }
      }
      
      console.log('Receipt sent successfully!');
      return true;
      
    } catch (error: any) {
      console.error('Receipt print error:', error);
      return false;
    }
  };

  const openCashDrawer = async (): Promise<boolean> => {
    if (printerType === 'web_print') {
      console.log('Cash drawer kick is handled by hardware settings on AirPrint');
      // Return true to mock success
      return true;
    }
    console.log('Sending kick drawer command...');
    const kickCommand = new Uint8Array([0x1B, 0x70, 0x00, 0x28, 0x50]);
    return await printReceipt(kickCommand);
  };

  // Auto-reconnect on context initialization
  useEffect(() => {
    if (printerType === 'bluetooth') {
      tryAutoReconnect();
    }
  }, [printerType]);

  // Monitor physical connection drops
  useEffect(() => {
    if (!bluetoothDevice) return;

    const handleDisconnection = (event: Event) => {
      console.log('GATT Server disconnected event fired:', event);
      setBluetoothDevice(null);
      
      const savedPrinter = localStorage.getItem('connectedPrinter');
      if (savedPrinter) {
        setBluetoothStatus('Printer disconnected. Click to reconnect.');
      } else {
        setBluetoothStatus('Disconnected');
      }
    };

    bluetoothDevice.addEventListener('gattserverdisconnected', handleDisconnection);

    return () => {
      bluetoothDevice.removeEventListener('gattserverdisconnected', handleDisconnection);
    };
  }, [bluetoothDevice]);

  const value: BluetoothContextType = {
    bluetoothDevice,
    bluetoothStatus,
    isConnecting,
    connectToBluetoothPrinter,
    disconnectPrinter,
    testPrint,
    printReceipt,
    openCashDrawer,
    printerType,
    setPrinterType,
    paperWidth,
    setPaperWidth,
    isBluetoothSupported
  };

  return (
    <BluetoothContext.Provider value={value}>
      {children}
    </BluetoothContext.Provider>
  );
};
