import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SplashScreen } from '../src/screens/SplashScreen';

const texts = (t: ReactTestRenderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

describe('SplashScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the app name and a loading message', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<SplashScreen ready={false} />);
    });
    expect(texts(tree)).toEqual(expect.arrayContaining(['Coach Connect', 'Getting things ready…']));
  });

  it('does not finish while the app is still starting', async () => {
    const onFinish = jest.fn();
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<SplashScreen ready={false} onFinish={onFinish} />);
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('finishes shortly after the app is ready', async () => {
    const onFinish = jest.fn();
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<SplashScreen ready onFinish={onFinish} />);
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
