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
  printReceipt: (receiptData: Uint8Array) => Promise<boolean>;
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

export const BluetoothProvider: React.FC<BluetoothProviderProps> = ({ children }) => {
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null);
  const [bluetoothStatus, setBluetoothStatus] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

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

    try {
      const printerInfo = JSON.parse(savedPrinter);
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
      localStorage.removeItem('connectedPrinter');
      setBluetoothStatus('');
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
      bluetoothDevice.removeEventListener('gattserverdisconnected', () => {});
      
      if (bluetoothDevice.gatt?.connected) {
        bluetoothDevice.gatt.disconnect();
      }
    }
    setBluetoothDevice(null);
    localStorage.removeItem('connectedPrinter');
    setBluetoothStatus('Disconnected');
  };

  const testPrint = async () => {
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
        0x1D, 0x21, 0x11,
        ...Array.from(new TextEncoder().encode('FOODMOOD POS\n')),
        0x1D, 0x21, 0x00,
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
      
      const chunkSize = 20;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        try {
          if (characteristic.properties.writeWithoutResponse) {
            await characteristic.writeValueWithoutResponse(chunk);
          } else {
            await characteristic.writeValue(chunk);
          }
          
          await new Promise(resolve => setTimeout(resolve, 50));
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

  const printReceipt = async (receiptData: Uint8Array): Promise<boolean> => {
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
      const chunkSize = 20;
      for (let i = 0; i < receiptData.length; i += chunkSize) {
        const chunk = receiptData.slice(i, i + chunkSize);
        
        try {
          if (characteristic.properties.writeWithoutResponse) {
            await characteristic.writeValueWithoutResponse(chunk);
          } else {
            await characteristic.writeValue(chunk);
          }
          
          await new Promise(resolve => setTimeout(resolve, 50));
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

  // Auto-reconnect on context initialization
  useEffect(() => {
    tryAutoReconnect();
  }, []);

  const value: BluetoothContextType = {
    bluetoothDevice,
    bluetoothStatus,
    isConnecting,
    connectToBluetoothPrinter,
    disconnectPrinter,
    testPrint,
    printReceipt
  };

  return (
    <BluetoothContext.Provider value={value}>
      {children}
    </BluetoothContext.Provider>
  );
};
