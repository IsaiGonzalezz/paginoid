'use client';

import React, { ReactNode } from 'react';
import { X, Plus } from 'lucide-react'; // Usamos Plus y X como iconos

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
    // Si no está abierto, no renderiza nada
    if (!isOpen) return null;

    return (
        // Fondo oscuro que ocupa toda la pantalla (fixed, z-50)
        <div 
            className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex justify-center items-center p-4 backdrop-blur-sm"
            onClick={onClose} // Cierra el modal al hacer clic en el fondo oscuro
        >
            <div 
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg my-8 transform transition-all"
                // Importante: evita que el clic dentro del modal lo cierre
                onClick={(e) => e.stopPropagation()} 
            >
                {/* Encabezado del Modal */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                        {/* Icono + para añadir */}
                        <Plus className="w-5 h-5 mr-2 text-indigo-600" />
                        {title}
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition duration-150"
                        aria-label="Cerrar modal"
                    >
                        {/* Icono X para cerrar */}
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Contenido del Modal */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
