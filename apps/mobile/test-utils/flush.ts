import ReactTestRenderer from 'react-test-renderer';

/** Let pending promises and effects finish (a request answered, a state set). */
export const ReactTestRendererFlush = () => ReactTestRenderer.act(async () => {});
