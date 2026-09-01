import type { RendererPoint, RendererViewport } from './projection';

export type RendererIntent =
  | Readonly<{
      type: 'select';
      target: 'node' | 'connection' | 'route-point';
      id: string;
    }>
  | Readonly<{
      type: 'preview';
      sourcePortId: string | null;
      targetPortId: string | null;
    }>
  | Readonly<{
      type: 'move-component';
      componentId: string;
      position: RendererPoint;
    }>
  | Readonly<{
      type: 'connect-ports';
      sourcePortId: string;
      targetPortId: string;
    }>
  | Readonly<{
      type: 'move-route-point';
      connectionId: string;
      routePointId: string;
      position: RendererPoint;
    }>
  | Readonly<{
      type: 'viewport-changed';
      viewport: RendererViewport;
    }>;

export type RendererIntentHandler = (intent: RendererIntent) => void;
