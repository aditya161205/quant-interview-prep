"""Synthetic market data for QuantPath's graded tasks, deterministic for a given seed.

Use it in the Playground too:  from data import gbm_panel, option_chain, factor_universe, ...
"""
import numpy as np
import pandas as pd
from scipy.stats import norm


def dates(n, start="2019-01-02"):
    return pd.bdate_range(start, periods=n, name="Date")


def gbm(n=1000, mu=0.08, sigma=0.2, s0=100.0, seed=0):
    """Geometric Brownian motion closing prices on business days."""
    rng = np.random.default_rng(seed)
    r = (mu - sigma**2 / 2) / 252 + sigma / np.sqrt(252) * rng.standard_normal(n - 1)
    return pd.Series(s0 * np.exp(np.r_[0.0, r.cumsum()]), index=dates(n), name="price")


def gbm_panel(n=1000, n_assets=5, corr=0.3, seed=0):
    """Correlated GBM prices for tickers A, B, C, ... with different drifts and volatilities."""
    rng = np.random.default_rng(seed)
    mu, sig = rng.uniform(0.0, 0.15, n_assets), rng.uniform(0.15, 0.45, n_assets)
    C = np.full((n_assets, n_assets), corr)
    np.fill_diagonal(C, 1.0)
    z = rng.standard_normal((n - 1, n_assets)) @ np.linalg.cholesky(C).T
    r = (mu - sig**2 / 2) / 252 + sig / np.sqrt(252) * z
    px = 100 * np.exp(np.vstack([np.zeros(n_assets), r.cumsum(0)]))
    return pd.DataFrame(px, index=dates(n), columns=[chr(65 + i) for i in range(n_assets)])


def normal_returns(n=1000, mu=4e-4, sigma=0.01, seed=0):
    rng = np.random.default_rng(seed)
    return pd.Series(mu + sigma * rng.standard_normal(n), index=dates(n), name="ret")


def fat_returns(n=1000, mu=4e-4, sigma=0.01, nu=4.0, seed=0):
    """Student-t daily returns scaled to standard deviation `sigma`."""
    rng = np.random.default_rng(seed)
    return pd.Series(mu + sigma * rng.standard_t(nu, n) * np.sqrt((nu - 2) / nu), index=dates(n), name="ret")


def bs_price(S, K, r, sigma, T, kind="call"):
    """Black-Scholes price (vectorized); used to build synthetic option chains."""
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    call = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    return np.where(np.asarray(kind) == "call", call, call - S + K * np.exp(-r * T))


def order_flow(n=2000, alpha=0.3, sigma=0.05, arrival=0.6, urgency=0.04, seed=0):
    """Market orders hitting a market maker. The true value moves ±sigma each step; informed traders
    (fraction alpha of orders) trade in the direction of the next move, the rest trade at random.
    Columns: mid (public price), side (+1 buy order, -1 sell order, 0 none), informed (bool), and
    limit: the furthest from mid the order will trade (noise traders: exponential with mean `urgency`;
    informed traders: sigma, the move they expect; 0 when there's no order)."""
    rng = np.random.default_rng(seed)
    move = sigma * rng.choice([-1.0, 1.0], n)
    mid = 100 + np.r_[0.0, np.cumsum(move[:-1])]
    has_order = rng.random(n) < arrival
    informed = has_order & (rng.random(n) < alpha)
    side = np.where(informed, np.sign(move), rng.choice([-1, 1], n)) * has_order
    limit = np.where(informed, sigma, rng.exponential(urgency, n)) * has_order
    return pd.DataFrame({"mid": mid, "side": side.astype(int), "informed": informed, "limit": limit})


def book_snapshots(n=500, seed=0):
    """Top-of-book snapshots: bid, ask, bid_size, ask_size (sizes in lots)."""
    rng = np.random.default_rng(seed)
    mid = 50 + np.cumsum(rng.normal(0, 0.02, n))
    spread = 0.01 * rng.integers(1, 4, n)
    bid = np.round(mid - spread / 2, 2)
    return pd.DataFrame({"bid": bid, "ask": np.round(bid + spread, 2),
                         "bid_size": rng.integers(1, 50, n) * 100, "ask_size": rng.integers(1, 50, n) * 100})


def option_chain(S=100.0, r=0.02, expiries=(1 / 12, 0.25, 0.5, 1.0), strikes=None, atm_vol=0.2,
                 skew=-0.15, smile=0.4, bad=0, seed=0):
    """European call and put quotes from a skewed smile, iv = atm(T) + skew*k + smile*k^2 with
    k = ln(K/F). Columns: T, strike, type, bid, ask. `bad` corrupts that many quotes (crossed
    markets or prices below intrinsic value), as real feeds do."""
    rng = np.random.default_rng(seed)
    strikes = np.arange(70, 135, 5.0) if strikes is None else np.asarray(strikes, dtype=float)
    rows = []
    for T in expiries:
        F = S * np.exp(r * T)
        for K in strikes:
            k = np.log(K / F)
            iv = max(atm_vol + 0.02 * np.sqrt(T) + skew * k + smile * k**2, 0.05)
            for kind in ("call", "put"):
                mid = float(bs_price(S, K, r, iv, T, kind)) * (1 + 0.002 * rng.standard_normal())
                half = 0.005 + 0.01 * mid
                rows.append((T, K, kind, round(max(mid - half, 0.0), 2), round(mid + half, 2)))
    out = pd.DataFrame(rows, columns=["T", "strike", "type", "bid", "ask"])
    for i, j in enumerate(rng.choice(len(out), size=bad, replace=False)):
        if i % 2:
            out.loc[j, "bid"] = out.loc[j, "ask"] + 0.05
        else:
            T, K, kind = out.loc[j, ["T", "strike", "type"]]
            intrinsic = max(S - K * np.exp(-r * T), 0) if kind == "call" else max(K * np.exp(-r * T) - S, 0)
            out.loc[j, ["bid", "ask"]] = [max(intrinsic - 1.0, 0.0), max(intrinsic - 0.5, 0.01)]
    return out


def factor_universe(n_days=1260, n_stocks=30, alpha_stocks=3, momentum=0.0, missing=0.0, alpha_range=(0.04, 0.10), seed=0):
    """Stocks driven by a 3-factor model: r_i = alpha_i + b_MKT*MKT + b_SMB*SMB + b_HML*HML + e_i.
    The first `alpha_stocks` tickers get a true annual alpha drawn from `alpha_range`. `momentum` > 0 adds slowly
    drifting expected returns, so past winners tend to keep winning. `missing` blanks a fraction of
    prices for a few tickers. Returns a dict: prices, market (returns), factors, betas, alphas."""
    rng = np.random.default_rng(seed)
    idx, tickers = dates(n_days), [f"T{i:02d}" for i in range(n_stocks)]
    factors = pd.DataFrame({"MKT": 3e-4 + 0.011 * rng.standard_normal(n_days),
                            "SMB": 0.006 * rng.standard_normal(n_days),
                            "HML": 0.005 * rng.standard_normal(n_days)}, index=idx)
    betas = pd.DataFrame({"MKT": rng.uniform(0.6, 1.5, n_stocks), "SMB": rng.normal(0, 0.6, n_stocks),
                          "HML": rng.normal(0, 0.6, n_stocks)}, index=tickers)
    alphas = pd.Series(0.0, index=tickers)
    alphas.iloc[:alpha_stocks] = rng.uniform(*alpha_range, alpha_stocks)
    drift = np.zeros((n_days, n_stocks))
    if momentum:
        z = rng.standard_normal(n_stocks)
        for t in range(n_days):
            z = 0.995 * z + np.sqrt(1 - 0.995**2) * rng.standard_normal(n_stocks)
            drift[t] = momentum * z
    idio = rng.uniform(0.01, 0.025, n_stocks)
    r = (alphas.to_numpy() / 252 + drift + factors.to_numpy() @ betas.to_numpy().T
         + idio * rng.standard_normal((n_days, n_stocks)))
    prices = pd.DataFrame(100 * np.cumprod(1 + r, axis=0), index=idx, columns=tickers)
    if missing:
        for col in rng.choice(tickers, size=max(1, n_stocks // 5), replace=False):
            prices.loc[rng.random(n_days) < missing, col] = np.nan
    return {"prices": prices, "market": factors["MKT"].rename("market"), "factors": factors,
            "betas": betas, "alphas": alphas}


def yield_curve_changes(n_days=1000, seed=0):
    """Daily yield changes (bp) at 1y..30y driven by Nelson-Siegel style level, slope and curvature factors."""
    rng = np.random.default_rng(seed)
    m = np.array([1, 2, 3, 5, 7, 10, 20, 30.0])
    x = m / 2.0
    slope = (1 - np.exp(-x)) / x
    loadings = np.vstack([np.ones_like(m), slope, slope - np.exp(-x)])
    f = rng.standard_normal((n_days, 3)) * [4.0, 8.0, 6.0]
    X = f @ loadings + 0.8 * rng.standard_normal((n_days, len(m)))
    return pd.DataFrame(X, index=dates(n_days), columns=[f"{int(v)}y" for v in m])


def ar1(n=1000, phi=0.9, sigma=1.0, c=0.0, seed=0):
    """AR(1): x_t = c + phi * x_{t-1} + e_t, started at its mean."""
    rng = np.random.default_rng(seed)
    x = np.empty(n)
    x[0] = c / (1 - phi) if phi != 1 else 0.0
    e = sigma * rng.standard_normal(n)
    for t in range(1, n):
        x[t] = c + phi * x[t - 1] + e[t]
    return pd.Series(x, index=dates(n), name="x")


def garch_returns(n=1500, omega=2e-6, alpha=0.08, beta=0.9, seed=0):
    """Zero-mean GARCH(1,1) daily returns with normal shocks."""
    rng = np.random.default_rng(seed)
    z = rng.standard_normal(n)
    r, s2 = np.empty(n), omega / (1 - alpha - beta)
    for t in range(n):
        if t:
            s2 = omega + alpha * r[t - 1] ** 2 + beta * s2
        r[t] = np.sqrt(s2) * z[t]
    return pd.Series(r, index=dates(n), name="ret")


def predictable_prices(n_days=2500, seed=0):
    """Daily closes and volumes whose next-day return is weakly predictable: a 5-day reversal effect
    plus a small 60-day trend effect, in a two-regime volatility environment. A realistic
    signal-to-noise ratio for ML experiments (AUC around 0.52-0.56)."""
    rng = np.random.default_rng(seed)
    vol = np.where(np.cumsum(rng.random(n_days) < 0.01) % 2 == 0, 0.009, 0.018)
    r = np.zeros(n_days)
    for t in range(n_days):
        mu = -0.05 * r[max(0, t - 5):t].sum() + 0.0004 * np.sign(r[max(0, t - 60):t].sum())
        r[t] = mu + vol[t] * rng.standard_normal()
    volume = rng.lognormal(14, 0.3, n_days) * (1 + 40 * np.abs(r))
    return pd.DataFrame({"close": 100 * np.cumprod(1 + r), "volume": volume.round()}, index=dates(n_days))


def capstone_universe(n_days=1500, n_stocks=60, momentum=0.0005, reversal=0.2, messy=True, seed=0):
    """Raw daily prices and volumes for a stock universe, built for an end-to-end research pipeline.
    Returns = beta * market + sector factor + idiosyncratic shock, plus two predictable effects:
    slowly drifting expected returns (momentum), and a partial reversal over the next 5 days of the
    temporary part of each shock, which is larger for low-volume moves (big-volume moves are news).
    With messy=True the raw data has the usual problems: missing days, decimal-error bad ticks,
    late listings and delistings. Returns a dict: prices, volume, sectors."""
    rng = np.random.default_rng(seed)
    idx, tickers = dates(n_days), [f"S{i:02d}" for i in range(n_stocks)]
    names = np.array(["Tech", "Financials", "Energy", "Health"])
    sector = rng.integers(0, len(names), n_stocks)
    mkt = 3e-4 + 0.011 * rng.standard_normal(n_days)
    sec = 0.006 * rng.standard_normal((n_days, len(names)))
    beta, sigma = rng.uniform(0.6, 1.5, n_stocks), rng.uniform(0.012, 0.025, n_stocks)
    z, drift = rng.standard_normal(n_stocks), np.empty((n_days, n_stocks))
    for t in range(n_days):
        z = 0.995 * z + np.sqrt(1 - 0.995**2) * rng.standard_normal(n_stocks)
        drift[t] = momentum * z
    eps = rng.standard_normal((n_days, n_stocks))
    abn = 0.6 * (np.abs(eps) - 0.8) + 0.8 * rng.standard_normal((n_days, n_stocks))  # abnormal log volume
    temp = sigma * eps / (1 + np.exp(2 * abn))  # temporary part: most of a low-volume move
    rev = np.zeros((n_days, n_stocks))
    for k in range(1, 6):
        rev[k:] -= reversal * temp[:-k] / 5
    r = mkt[:, None] * beta + sec[:, sector] + drift + sigma * eps + rev
    prices = pd.DataFrame(np.exp(rng.uniform(np.log(10), np.log(300), n_stocks)) * np.cumprod(1 + r, axis=0),
                          index=idx, columns=tickers).round(2)
    volume = pd.DataFrame(np.exp(rng.uniform(11, 15, n_stocks) + 0.4 * abn).round(-2), index=idx, columns=tickers)
    if messy:
        late, gone = rng.choice(n_stocks, 4, replace=False).reshape(2, 2)
        for j in late:
            prices.iloc[:rng.integers(250, 400), j] = np.nan
        for j in gone:
            prices.iloc[rng.integers(n_days - 300, n_days - 100):, j] = np.nan
        for j in rng.choice(n_stocks, 10, replace=False):
            prices.iloc[rng.choice(n_days, n_days // 100, replace=False), j] = np.nan
        P = prices.to_numpy()
        ok = ~np.isnan(P[:-2]) & ~np.isnan(P[1:-1]) & ~np.isnan(P[2:])
        rows, cols = np.nonzero(ok)
        for i in rng.choice(len(rows), 8, replace=False):
            prices.iloc[rows[i] + 1, cols[i]] *= rng.choice([10.0, 0.1])
        volume = volume.where(prices.notna())
    return {"prices": prices, "volume": volume, "sectors": pd.Series(names[sector], index=tickers, name="sector")}


def ssvi_slice(theta, rho=-0.7, eta=1.0, gamma=0.5):
    """Raw SVI parameters (a, b, rho, m, sigma) of one expiry of an SSVI surface with ATM total variance
    theta. With eta * sqrt(1 + |rho|) <= 2 and gamma = 0.5 the surface is free of static arbitrage."""
    phi = eta / theta**gamma
    return theta / 2 * (1 - rho**2), theta * phi / 2, rho, -rho / phi, np.sqrt(1 - rho**2) / phi


def svi_w(k, a, b, rho, m, sigma):
    """Raw SVI total implied variance w(k) = a + b(rho(k - m) + sqrt((k - m)^2 + sigma^2))."""
    k = np.asarray(k, dtype=float)
    return a + b * (rho * (k - m) + np.sqrt((k - m) ** 2 + sigma**2))


def svi_chain(S=100.0, r=0.02, expiries=(1 / 12, 0.25, 0.5, 1.0), strikes=None, atm_vol=0.18, rho=-0.7, eta=1.0,
              bad=0, seed=0):
    """Call and put quotes (T, strike, type, bid, ask) from an arbitrage-free SSVI surface whose ATM vol
    rises with expiry. `bad` corrupts that many quotes, as in option_chain."""
    rng = np.random.default_rng(seed)
    strikes = np.arange(50, 162.5, 2.5) if strikes is None else np.asarray(strikes, dtype=float)
    rows = []
    for T in expiries:
        F = S * np.exp(r * T)
        params = ssvi_slice((atm_vol + 0.03 * np.sqrt(T)) ** 2 * T, rho, eta)
        iv = np.sqrt(svi_w(np.log(strikes / F), *params) / T)
        for kind in ("call", "put"):
            mid = bs_price(S, strikes, r, iv, T, kind) * (1 + 0.002 * rng.standard_normal(len(strikes)))
            half = 0.005 + 0.01 * mid
            rows += [(T, K, kind, round(max(m - h, 0.0), 2), round(m + h, 2)) for K, m, h in zip(strikes, mid, half)]
    out = pd.DataFrame(rows, columns=["T", "strike", "type", "bid", "ask"])
    for i, j in enumerate(rng.choice(len(out), size=bad, replace=False)):
        out.loc[j, ["bid", "ask"]] = [out.loc[j, "ask"] + 0.05, out.loc[j, "ask"]] if i % 2 else [0.0, 0.01]
    return out


def vol_universe(n_days=1500, n_names=30, vrp=0.2, ohlc=False, messy=False, seed=0):
    """Daily data for stocks with stochastic volatility, as a long DataFrame (date, ticker, close, rv, iv).
    Log variance = slow market factor + slow stock factor + fast factor with a leverage effect, plus rare
    market-wide vol spikes that come with a sell-off. `rv` is the day's realized variance from 78 intraday
    returns plus the overnight return; `iv` is the 1-month (21-day) ATM implied vol: the expected variance over
    the next 21 days times (1 + premium), where the premium averages `vrp` and drifts slowly per stock.
    ohlc=True adds open, high, low. messy=True adds missing values and implied vols quoted in percent."""
    rng = np.random.default_rng(seed)
    T, N, M, ov, h = n_days, n_names, 78, 0.15, np.arange(1, 22)
    ps, pf, pp, ss, sm, sf, sp = 0.985, 0.8, 0.98, 0.05, 0.06, 0.25, 0.03
    var = lambda sd, p, n: sd**2 * (1 - p ** (2 * n)) / (1 - p**2)
    mu = np.log(rng.uniform(0.18, 0.40, N) ** 2 / 252) - 0.5 * (var(ss, ps, 10**6) + var(sm, ps, 10**6) + var(sf, pf, 10**6))
    sm_t, ss_t, f_t, p_t = 0.0, np.zeros(N), np.zeros(N), np.zeros(N)
    logv, R, prem, ev = np.empty((T, N)), np.empty((T, N)), np.empty((T, N)), np.empty((T, N))
    for t in range(T):
        logv[t] = mu + sm_t + ss_t + f_t
        prem[t] = np.maximum(vrp + p_t, -0.5)
        ev[t] = np.exp(mu[:, None] + ps ** h * (sm_t + ss_t)[:, None] + pf ** h * f_t[:, None]
                       + 0.5 * (var(sm, ps, h) + var(ss, ps, h) + var(sf, pf, h))).mean(axis=1)
        jump = rng.random() < 1 / 400
        z = np.sqrt(0.3) * rng.standard_normal() + np.sqrt(0.7) * rng.standard_normal(N) - 4.0 * jump
        v = np.exp(logv[t])
        R[t] = -0.5 * v + np.sqrt(v) * z
        sm_t = ps * sm_t + sm * rng.standard_normal() + 1.2 * jump
        ss_t = ps * ss_t + ss * rng.standard_normal(N)
        f_t = pf * f_t + sf * (-0.5 * np.clip(z, -4, 4) / 1.0 + np.sqrt(0.75) * rng.standard_normal(N))
        p_t = pp * p_t + sp * rng.standard_normal(N)
    v = np.exp(logv)
    on = np.sqrt(ov * v) * rng.standard_normal((T, N))
    steps = np.sqrt((1 - ov) * v / M)[..., None] * rng.standard_normal((T, N, M))
    walk = np.cumsum(steps, axis=2)
    walk -= np.arange(1, M + 1) / M * (walk[..., -1:] - (R - on)[..., None])  # bridge to the day's close
    rv = on**2 + (np.diff(walk, axis=2, prepend=0.0) ** 2).sum(axis=2)
    close = 100 * np.exp(np.cumsum(R, axis=0))
    iv = np.sqrt(252 * (1 + prem) * ev) * np.exp(0.02 * rng.standard_normal((T, N)))
    cols = {"close": close, "rv": rv, "iv": iv}
    if ohlc:
        prev = np.vstack([np.full((1, N), 100.0), close[:-1]])
        opn = prev * np.exp(on)
        cols = {"open": opn, "high": opn * np.exp(np.maximum(walk.max(axis=2), 0)),
                "low": opn * np.exp(np.minimum(walk.min(axis=2), 0)), **cols}
    out = pd.DataFrame({"date": np.repeat(dates(T), N), "ticker": np.tile([f"V{i:02d}" for i in range(N)], T),
                        **{k: c.ravel() for k, c in cols.items()}})
    if messy:
        out.loc[rng.random(len(out)) < 0.01, "iv"] = np.nan
        out.loc[rng.choice(len(out), 12, replace=False), "iv"] *= 100
        gappy = out["ticker"].isin(rng.choice(out["ticker"].unique(), max(1, N // 6), replace=False))
        out.loc[gappy & (rng.random(len(out)) < 0.01), ["close", "rv"]] = np.nan
    return out


def sv_ohlc(n_days=1500, vrp=0.2, seed=0):
    """One stock from vol_universe as a date-indexed DataFrame: open, high, low, close, rv, iv."""
    return vol_universe(n_days, 1, vrp=vrp, ohlc=True, seed=seed).drop(columns="ticker").set_index("date")
