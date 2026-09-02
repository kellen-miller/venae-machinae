export type Rx7CapacityScale = 1 | 2 | 5;

const BASE_RX7_CAPACITY_COUNTS = Object.freeze({
  components: 26,
  ports: 65,
  connections: 32
});

export const RX7_CAPACITY_COUNTS = Object.freeze({
  1: { ...BASE_RX7_CAPACITY_COUNTS },
  2: {
    components: BASE_RX7_CAPACITY_COUNTS.components * 2,
    ports: BASE_RX7_CAPACITY_COUNTS.ports * 2,
    connections: BASE_RX7_CAPACITY_COUNTS.connections * 2
  },
  5: {
    components: BASE_RX7_CAPACITY_COUNTS.components * 5,
    ports: BASE_RX7_CAPACITY_COUNTS.ports * 5,
    connections: BASE_RX7_CAPACITY_COUNTS.connections * 5
  }
});
