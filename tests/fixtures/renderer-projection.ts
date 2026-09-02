import type { RendererProjection } from '../../src/lib/renderer/projection';

export const rendererGateProjection = {
  revision: 14,
  nodes: [
    {
      id: 'fuel-pump',
      label: 'Fuel pump',
      kind: 'pump',
      position: { x: 80, y: 110 },
      width: 220,
      height: 150,
      selected: true,
      ports: [
        {
          id: 'pump-power',
          nodeId: 'fuel-pump',
          label: 'Pump power',
          domain: 'electrical',
          direction: 'input',
          side: 'left',
          offset: 0.35,
          compatibility: 'compatible'
        },
        {
          id: 'pump-outlet',
          nodeId: 'fuel-pump',
          label: 'Fuel outlet',
          domain: 'fluid',
          direction: 'output',
          side: 'right',
          offset: 0.65,
          compatibility: 'compatible'
        }
      ]
    },
    {
      id: 'fuel-rail',
      label: 'Fuel rail',
      kind: 'rail',
      position: { x: 590, y: 145 },
      width: 210,
      height: 130,
      selected: false,
      ports: [
        {
          id: 'rail-inlet',
          nodeId: 'fuel-rail',
          label: 'Rail inlet',
          domain: 'fluid',
          direction: 'input',
          side: 'left',
          offset: 0.5,
          compatibility: 'compatible'
        }
      ]
    },
    {
      id: 'fuse-panel',
      label: 'Fuse panel',
      kind: 'electrical',
      position: { x: 75, y: 390 },
      width: 210,
      height: 130,
      selected: false,
      ports: [
        {
          id: 'fuse-output',
          nodeId: 'fuse-panel',
          label: 'Fused 12 V',
          domain: 'electrical',
          direction: 'output',
          side: 'right',
          offset: 0.5,
          compatibility: 'compatible'
        }
      ]
    }
  ],
  connections: [
    {
      id: 'fuel-feed',
      label: 'Fuel feed',
      sourcePortId: 'pump-outlet',
      targetPortId: 'rail-inlet',
      physical: {
        kind: 'hose',
        medium: 'gasoline',
        temperature: 'ambient',
        direction: 'forward'
      },
      routePoints: [
        { id: 'fuel-feed-route-1', position: { x: 390, y: 210 } },
        { id: 'fuel-feed-route-2', position: { x: 490, y: 210 } }
      ],
      selected: false
    },
    {
      id: 'pump-supply',
      label: 'Pump supply',
      sourcePortId: 'fuse-output',
      targetPortId: 'pump-power',
      physical: {
        kind: 'wire',
        conductorColor: '#d83b36',
        conductorStripe: '#f6d24a',
        conductorScale: 12,
        direction: 'forward'
      },
      routePoints: [{ id: 'pump-supply-route-1', position: { x: 350, y: 455 } }],
      selected: true
    }
  ],
  overlayMarks: [
    {
      id: 'fuel-feed-direction',
      connectionId: 'fuel-feed',
      channel: 'direction',
      label: 'Flow toward rail'
    },
    {
      id: 'fuel-feed-temperature',
      connectionId: 'fuel-feed',
      channel: 'temperature',
      label: 'Ambient fuel'
    },
    {
      id: 'pump-supply-potential',
      connectionId: 'pump-supply',
      channel: 'potential',
      label: '12 V supply'
    },
    {
      id: 'pump-supply-selection',
      connectionId: 'pump-supply',
      channel: 'selection',
      label: 'Selected conductor'
    }
  ]
} as const satisfies RendererProjection;
