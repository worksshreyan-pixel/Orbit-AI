import { BrowserSpeechProvider } from '../../lib/voice/stt';
import { BrowserTTSProvider } from '../../lib/voice/tts';

describe('Voice Providers', () => {
  beforeEach(() => {
    // Mock browser APIs
    (global as any).window = {
      speechSynthesis: {
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        getVoices: jest.fn(() => []),
      },
      SpeechRecognition: class MockSpeechRecognition {
        start = jest.fn();
        stop = jest.fn();
        abort = jest.fn();
      }
    };

    (global as any).SpeechSynthesisUtterance = class MockSpeechSynthesisUtterance {
      text: string = '';
      volume: number = 1;
      rate: number = 1;
      pitch: number = 1;
      voice: any = null;
      constructor(text: string) {
        this.text = text;
      }
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('BrowserSpeechProvider', () => {
    it('should be supported if SpeechRecognition exists', () => {
      const stt = new BrowserSpeechProvider();
      expect(stt.isSupported()).toBe(true);
    });

    it('should handle startListening', () => {
      const stt = new BrowserSpeechProvider();
      const mockResult = jest.fn();
      const mockError = jest.fn();
      const mockEnd = jest.fn();
      
      stt.startListening(mockResult, mockError, mockEnd);
      expect((stt as any).recognition.start).toHaveBeenCalled();
    });

    it('should handle cancelListening', () => {
      const stt = new BrowserSpeechProvider();
      stt.startListening(jest.fn(), jest.fn(), jest.fn());
      stt.cancelListening();
      expect((stt as any).recognition.abort).toHaveBeenCalled();
    });
  });

  describe('BrowserTTSProvider', () => {
    it('should be supported if speechSynthesis exists', () => {
      const tts = new BrowserTTSProvider();
      expect(tts.isSupported()).toBe(true);
    });

    it('should speak text with options', () => {
      const tts = new BrowserTTSProvider();
      tts.speak('hello', { volume: 0.5, rate: 1.2 });
      
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
      const utterance = (window.speechSynthesis.speak as jest.Mock).mock.calls[0][0];
      expect(utterance.text).toBe('hello');
      expect(utterance.volume).toBe(0.5);
      expect(utterance.rate).toBe(1.2);
    });
  });
});
