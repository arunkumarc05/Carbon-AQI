import numpy as np
from stable_baselines3 import PPO
import os

# Load the trained PPO agent
MODEL_PATH = os.path.join(os.path.dirname(__file__), "saved_models", "ppo_agent.zip")
model = PPO.load(MODEL_PATH)

# Define mitigation strategies (same as rl_env.py)
STRATEGIES = {
    0: {
        "name": "Issue Health Advisory",
        "description": "Reduce human exposure through health warnings"
    },
    1: {
        "name": "Recommend Public Transport",
        "description": "Reduce vehicle emissions by promoting public transportation"
    },
    2: {
        "name": "Industrial Emission Alert",
        "description": "Notify industries to reduce output and emissions"
    },
    3: {
        "name": "Recommend Work From Home",
        "description": "Reduce traffic by encouraging remote work"
    },
    4: {
        "name": "Green Zone Advisory",
        "description": "Recommend parks and green areas for cleaner air"
    },
    5: {
        "name": "Outdoor Activity Ban",
        "description": "Emergency high AQI response with outdoor activity restrictions"
    }
}


def get_mitigation_strategy(pm25, pm10, no2, co, so2, aqi):
    """
    Get the optimal mitigation strategy based on current air quality parameters.
    
    Args:
        pm25 (float): PM2.5 concentration
        pm10 (float): PM10 concentration
        no2 (float): NO2 concentration
        co (float): CO concentration
        so2 (float): SO2 concentration
        aqi (float): Air Quality Index
    
    Returns:
        dict: Recommended mitigation strategy with details
    """
    # Build state array
    state = np.array([pm25, pm10, no2, co, so2, aqi], dtype=np.float32)
    
    # Get action from trained model
    action, _ = model.predict(state, deterministic=True)
    action = int(action)
    
    # Calculate estimated reward based on action and current AQI
    estimated_reward = calculate_reward(aqi, action)
    
    return {
        "action_id": action,
        "strategy_name": STRATEGIES[action]["name"],
        "description": STRATEGIES[action]["description"],
        "rl_reward": estimated_reward
    }


def get_enhanced_strategy(current_data: dict, forecast_data: dict) -> dict:
    """
    Get a forecast-aware mitigation strategy using both current pollutant
    readings and the 7-day AQI forecast produced by the XGBoost service.

    Args:
        current_data (dict): Keys — pm25, pm10, no2, co, so2, o3, aqi_value
        forecast_data (dict): Output of services/aqi_forecast.get_forecast()
                              Must contain: forecast (list), trend (str),
                              days_above_200 (int), days_above_300 (int)

    Returns:
        dict: Enhanced strategy with urgency, trigger_reason, forecast_driven
    """
    # ------------------------------------------------------------------ #
    # 1. Extract values with safe defaults                                  #
    # ------------------------------------------------------------------ #
    pm25        = float(current_data.get("pm25")       or 0.0)
    pm10        = float(current_data.get("pm10")       or 0.0)
    no2         = float(current_data.get("no2")        or 0.0)
    co          = float(current_data.get("co")         or 0.0)
    so2         = float(current_data.get("so2")        or 0.0)
    o3          = float(current_data.get("o3")         or 0.0)
    current_aqi = float(current_data.get("aqi_value") or current_data.get("aqi") or 0.0)

    forecast_list  = forecast_data.get("forecast", [])
    trend          = forecast_data.get("trend", "stable")
    days_above_200 = int(forecast_data.get("days_above_200", 0))
    days_above_300 = int(forecast_data.get("days_above_300", 0))

    # Safe accessors for specific forecast days (0-indexed)
    def _pred(day_index: int) -> float:
        try:
            return float(forecast_list[day_index]["predicted_aqi"])
        except (IndexError, KeyError, TypeError):
            return current_aqi

    aqi_day1 = _pred(0)   # tomorrow
    aqi_day3 = _pred(2)   # day 3
    aqi_day7 = _pred(6)   # day 7

    trend_flag = 1.0 if trend == "increasing" else (-1.0 if trend == "decreasing" else 0.0)

    # ------------------------------------------------------------------ #
    # 2. Build 13-element enhanced state vector                            #
    # ------------------------------------------------------------------ #
    enhanced_state = [
        pm25, pm10, no2, co, so2, o3,
        current_aqi,
        aqi_day1,
        aqi_day3,
        aqi_day7,
        trend_flag,
        float(days_above_200),
        float(days_above_300),
    ]

    # ------------------------------------------------------------------ #
    # 3. Pad / trim to match the PPO model's observation space (6 dims)   #
    # ------------------------------------------------------------------ #
    model_obs_size = model.observation_space.shape[0]  # typically 6
    if len(enhanced_state) >= model_obs_size:
        model_input = enhanced_state[:model_obs_size]
    else:
        pad = [0.0] * (model_obs_size - len(enhanced_state))
        model_input = enhanced_state + pad

    state_array = np.array(model_input, dtype=np.float32)

    # ------------------------------------------------------------------ #
    # 4. Predict action with the existing PPO model                        #
    # ------------------------------------------------------------------ #
    action, _ = model.predict(state_array, deterministic=True)
    action = int(action)

    estimated_reward = calculate_reward(current_aqi, action)

    # ------------------------------------------------------------------ #
    # 5. Urgency scoring                                                   #
    # ------------------------------------------------------------------ #
    if days_above_300 > 0 or current_aqi > 300:
        urgency = "immediate"
    elif days_above_200 > 2 or trend == "increasing":
        urgency = "warning"
    else:
        urgency = "advisory"

    # ------------------------------------------------------------------ #
    # 6. Human-readable trigger reason                                     #
    # ------------------------------------------------------------------ #
    # Find the peak forecast day for the reason string
    peak_aqi = forecast_data.get("peak_aqi", current_aqi)
    peak_day = forecast_data.get("peak_day", 1)

    if urgency == "immediate":
        if current_aqi > 300:
            trigger_reason = f"Current AQI is critically high at {round(current_aqi)}"
        else:
            trigger_reason = (
                f"AQI forecast to reach {round(peak_aqi)} on Day {peak_day} "
                f"(hazardous threshold exceeded)"
            )
    elif urgency == "warning":
        if trend == "increasing":
            trigger_reason = (
                f"AQI forecast to reach {round(peak_aqi)} on Day {peak_day} "
                f"with an increasing trend"
            )
        else:
            trigger_reason = (
                f"AQI forecast above 200 for {days_above_200} day(s) — "
                f"sustained poor air quality expected"
            )
    else:
        trigger_reason = (
            f"Precautionary advisory — current AQI {round(current_aqi)}, "
            f"forecast stable"
        )

    # ------------------------------------------------------------------ #
    # 7. Return enriched strategy dict                                     #
    # ------------------------------------------------------------------ #
    return {
        "action_id":      action,
        "strategy_name":  STRATEGIES[action]["name"],
        "description":    STRATEGIES[action]["description"],
        "rl_reward":      estimated_reward,
        "urgency":        urgency,
        "trigger_reason": trigger_reason,
        "forecast_driven": True,
    }


def calculate_reward(aqi, action):
    """
    Calculate estimated reward based on AQI level and action taken.
    This mirrors the reward calculation from the RL environment.
    
    Args:
        aqi (float): Current AQI value
        action (int): Action taken
    
    Returns:
        float: Estimated reward
    """
    # Calculate expected AQI reduction based on action
    reduction_factor = 0.0
    
    if action in [0, 4]:  # Health Advisory, Green Zone Advisory
        reduction_factor = 0.075  # Average of 5-10%
    elif action in [1, 3]:  # Public Transport, Work From Home
        if aqi > 100:
            reduction_factor = 0.125  # Average of 10-15%
        else:
            reduction_factor = 0.035  # Average of 2-5%
    elif action == 2:  # Industrial Emission Alert
        if aqi > 150:
            reduction_factor = 0.175  # Average of 15-20%
        else:
            reduction_factor = 0.065  # Average of 5-8%
    elif action == 5:  # Outdoor Activity Ban (emergency)
        if aqi > 200:
            reduction_factor = 0.225  # Average of 20-25%
        else:
            reduction_factor = -0.05  # Penalty for overreacting
    
    # Calculate expected new AQI
    new_aqi = aqi * (1 - reduction_factor)
    new_aqi = max(0, new_aqi)
    
    # Calculate reward based on expected new AQI
    if new_aqi < 50:
        reward = 2.0  # Good air quality
    elif 50 <= new_aqi < 100:
        reward = 1.0  # Satisfactory
    elif 100 <= new_aqi < 200:
        reward = -0.5  # Still unhealthy
    else:
        reward = -2.0  # Very poor air quality
    
    # Bonus for appropriate action selection
    if action == 5 and aqi > 200:  # Emergency action for very poor AQI
        reward += 0.5
    elif action == 2 and 150 < aqi <= 200:  # Industrial alert for poor AQI
        reward += 0.5
    elif action in [1, 3] and 100 < aqi <= 150:  # Transport/Work for moderate AQI
        reward += 0.5
    elif action in [0, 4] and aqi <= 100:  # Advisory for good/moderate AQI
        reward += 0.5
    
    return reward


if __name__ == "__main__":
    # Test with sample high-AQI values
    print("Testing RL Agent with sample air quality data...")
    print("=" * 60)
    
    # Test case 1: Very poor air quality
    test_cases = [
        {
            "name": "Very Poor Air Quality",
            "params": (350.0, 400.0, 180.0, 15.0, 80.0, 250.0)
        },
        {
            "name": "Poor Air Quality", 
            "params": (180.0, 200.0, 120.0, 8.0, 45.0, 160.0)
        },
        {
            "name": "Moderate Air Quality",
            "params": (80.0, 90.0, 60.0, 4.0, 25.0, 85.0)
        },
        {
            "name": "Good Air Quality",
            "params": (30.0, 40.0, 25.0, 2.0, 15.0, 45.0)
        }
    ]
    
    for test_case in test_cases:
        pm25, pm10, no2, co, so2, aqi = test_case["params"]
        
        print(f"\n{test_case['name']}:")
        print(f"  PM2.5: {pm25}, PM10: {pm10}, NO2: {no2}, CO: {co}, SO2: {so2}, AQI: {aqi}")
        
        strategy = get_mitigation_strategy(pm25, pm10, no2, co, so2, aqi)
        
        print(f"  Recommended Action: {strategy['action_id']} - {strategy['strategy_name']}")
        print(f"  Description: {strategy['description']}")
        print(f"  Expected Reward: {strategy['rl_reward']:.2f}")
    
    print("\n" + "=" * 60)
    print("RL Agent testing completed!")