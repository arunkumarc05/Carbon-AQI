import os 
import gymnasium as gym
import numpy as np
import pandas as pd
from gymnasium import spaces


class AQIMitigationEnv(gym.Env):
    """Custom OpenAI Gymnasium environment for air quality mitigation using reinforcement learning."""
    
    # Define mitigation strategies
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
    
    def __init__(self):
        super().__init__()
        
        # Load the cleaned AQI data
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.data = pd.read_csv(os.path.join(BASE_DIR, 'data', 'cleaned', 'aqi_cleaned.csv'))
        self.current_step = 0
        
        # Define action space: 6 discrete mitigation strategies
        self.action_space = spaces.Discrete(6)
        
        # Define observation space: 6 continuous values [PM2.5, PM10, NO2, CO, SO2, AQI]
        self.observation_space = spaces.Box(
            low=0, 
            high=1000, 
            shape=(6,), 
            dtype=np.float32
        )
        
        # Initialize current AQI for tracking
        self.current_aqi = 0
        
    def reset(self, seed=None):
        """Reset the environment to a random initial state."""
        super().reset(seed=seed)
        
        # Sample a random row from data as initial state
        random_idx = np.random.randint(0, len(self.data))
        initial_row = self.data.iloc[random_idx]
        
        # Extract state: [PM2.5, PM10, NO2, CO, SO2, AQI]
        state = np.array([
            initial_row['PM2.5'],
            initial_row['PM10'],
            initial_row['NO2'],
            initial_row['CO'],
            initial_row['SO2'],
            initial_row['AQI']
        ], dtype=np.float32)
        
        # Set current AQI
        self.current_aqi = state[5]
        self.current_step = random_idx
        
        return state, {}
    
    def step(self, action):
        """Execute one step in the environment with the given action."""
        if not self.action_space.contains(action):
            raise ValueError(f"Invalid action {action}")
        
        # Calculate AQI reduction based on action type
        reduction_factor = 0.0
        
        if action in [0, 4]:  # Health Advisory, Green Zone Advisory
            reduction_factor = np.random.uniform(0.05, 0.10)  # 5-10% reduction
        elif action in [1, 3]:  # Public Transport, Work From Home
            if self.current_aqi > 100:
                reduction_factor = np.random.uniform(0.10, 0.15)  # 10-15% reduction
            else:
                reduction_factor = np.random.uniform(0.02, 0.05)  # Small effect if AQI is already low
        elif action == 2:  # Industrial Emission Alert
            if self.current_aqi > 150:
                reduction_factor = np.random.uniform(0.15, 0.20)  # 15-20% reduction
            else:
                reduction_factor = np.random.uniform(0.05, 0.08)  # Moderate effect
        elif action == 5:  # Outdoor Activity Ban (emergency)
            if self.current_aqi > 200:
                reduction_factor = np.random.uniform(0.20, 0.25)  # 20-25% reduction
            else:
                reduction_factor = -0.05  # Penalty for overreacting (5% increase)
        
        # Calculate new AQI
        new_aqi = self.current_aqi * (1 - reduction_factor)
        new_aqi = max(0, new_aqi)  # Ensure AQI doesn't go negative
        
        # Calculate reward based on new AQI level
        if new_aqi < 50:
            reward = 2.0  # Good air quality
        elif 50 <= new_aqi < 100:
            reward = 1.0  # Satisfactory
        elif 100 <= new_aqi < 200:
            reward = -0.5  # Still unhealthy
        else:
            reward = -2.0  # Very poor air quality
        
        # Bonus for appropriate action selection
        if action == 5 and self.current_aqi > 200:  # Emergency action for very poor AQI
            reward += 0.5
        elif action == 2 and 150 < self.current_aqi <= 200:  # Industrial alert for poor AQI
            reward += 0.5
        elif action in [1, 3] and 100 < self.current_aqi <= 150:  # Transport/Work for moderate AQI
            reward += 0.5
        elif action in [0, 4] and self.current_aqi <= 100:  # Advisory for good/moderate AQI
            reward += 0.5
        
        # Move to next data row
        self.current_step += 1
        
        # Get next state or terminate if we've reached the end
        if self.current_step < len(self.data):
            next_row = self.data.iloc[self.current_step]
            new_state = np.array([
                next_row['PM2.5'],
                next_row['PM10'],
                next_row['NO2'],
                next_row['CO'],
                next_row['SO2'],
                new_aqi  # Use calculated new AQI instead of data AQI
            ], dtype=np.float32)
            terminated = False
        else:
            new_state = np.array([0, 0, 0, 0, 0, new_aqi], dtype=np.float32)
            terminated = True
        
        # Update current AQI
        self.current_aqi = new_aqi
        
        # Create info dictionary
        info = {
            "strategy": self.STRATEGIES[int(action)],
            "new_aqi": new_aqi,
            "reduction_factor": reduction_factor
        }
        
        return new_state, reward, terminated, False, info
    
    def render(self):
        """Render the current state of the environment."""
        print(f"Current Step: {self.current_step}")
        print(f"Current AQI: {self.current_aqi:.2f}")
        print(f"State Space: PM2.5, PM10, NO2, CO, SO2, AQI")
        if hasattr(self, '_current_state'):
            print(f"Current State: {self._current_state}")
        print("-" * 50)


# Test the environment
if __name__ == "__main__":
    env = AQIMitigationEnv()
    
    # Test reset
    obs, _ = env.reset()
    print(f"Initial observation: {obs}")
    
    # Test step
    action = 1  # Recommend Public Transport
    obs, reward, done, _, info = env.step(action)
    
    print(f"Action taken: {env.STRATEGIES[action]['name']}")
    print(f"New observation: {obs}")
    print(f"Reward: {reward}")
    print(f"Done: {done}")
    print(f"Info: {info}")
    
    # Test render
    env.render()