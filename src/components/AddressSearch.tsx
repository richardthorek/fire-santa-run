import { useState, useCallback, useRef, useEffect } from 'react';
import { searchAddress, type GeocodingResult } from '../utils/mapbox';

export interface AddressSearchProps {
  onSelect: (result: GeocodingResult) => void;
  proximity?: [number, number];
  placeholder?: string;
  className?: string;
}

/**
 * Address search component using Mapbox Geocoding API
 */
export function AddressSearch({
  onSelect,
  proximity,
  placeholder = 'Search for an address...',
  className = '',
}: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await searchAddress(searchQuery, proximity);
      setResults(searchResults);
      setIsOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [proximity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce search by 500ms
    timeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 500);
  };

  const handleSelect = (result: GeocodingResult) => {
    onSelect(result);
    setQuery(result.place_name);
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '0.75rem 2.5rem 0.75rem 1rem',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '1rem',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
        />
        
        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.25rem',
              color: '#9e9e9e',
              padding: '0.25rem',
            }}
            title="Clear search"
          >
            ✕
          </button>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9e9e9e',
          }}>
            ⟳
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '0.75rem',
          marginTop: '0.5rem',
          backgroundColor: '#ffebee',
          color: '#d32f2f',
          borderRadius: '8px',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 0.5rem)',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 1000,
        }}>
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: 'none',
                backgroundColor: 'white',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                borderBottom: '1px solid #f5f5f5',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                {result.place_name.split(',')[0]}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#616161' }}>
                {result.place_name}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
