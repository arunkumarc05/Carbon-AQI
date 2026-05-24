import os
import numpy as np
from collections import Counter

# Import custom environment and RL libraries
from rl_env import AQIMitigationEnv
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env


def train_ppo_agent():
    """Train a PPO agent for air quality mitigation."""
    
    print("Starting PPO training for AQI mitigation...")
    
    # Create environment
    env = AQIMitigationEnv()
    print("Environment created successfully.")
    
    # Validate environment
    try:
        check_env(env)
        print("✓ Environment validation passed!")
    except Exception as e:
        print(f"✗ Environment validation failed: {e}")
        return
    
    # Create PPO model
    model = PPO(
        "MlpPolicy", 
        env, 
        verbose=1,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        tensorboard_log="./ml/logs/"
    )
    print("PPO model created.")
    
    # Train the model
    print("Training started...")
    model.learn(total_timesteps=50000, progress_bar=True)
    print("Training completed!")
    
    # Save the model
    os.makedirs("./ml/saved_models", exist_ok=True)
    model.save("ml/saved_models/ppo_agent")
    print("PPO agent saved!")
    
    # Evaluate the trained model
    print("\nEvaluating trained model...")
    evaluate_model(model, env)
    
    print("Training complete. Model saved to ml/saved_models/ppo_agent.zip")


def evaluate_model(model, env, num_episodes=10):
    """Evaluate the trained PPO model over multiple episodes."""
    
    total_rewards = []
    all_actions = []
    
    for episode in range(num_episodes):
        obs, _ = env.reset()
        episode_reward = 0
        episode_actions = []
        done = False
        step_count = 0
        
        while not done and step_count < 1000:  # Prevent infinite episodes
            # Use deterministic action for evaluation
            action, _ = model.predict(obs, deterministic=True)
            action = int(action)  # Convert numpy array to int
            obs, reward, done, _, info = env.step(action)
            
            episode_reward += reward
            episode_actions.append(action)
            step_count += 1
        
        total_rewards.append(episode_reward)
        all_actions.extend(episode_actions)
        
        print(f"Episode {episode + 1}: Reward = {episode_reward:.2f}, Steps = {step_count}")
    
    # Calculate and print statistics
    avg_reward = np.mean(total_rewards)
    std_reward = np.std(total_rewards)
    
    print(f"\n=== Evaluation Results ===")
    print(f"Average reward per episode: {avg_reward:.2f} ± {std_reward:.2f}")
    print(f"Total episodes evaluated: {num_episodes}")
    
    # Analyze action distribution
    action_counts = Counter(all_actions)
    total_actions = len(all_actions)
    
    print(f"\n=== Strategy Distribution ===")
    for action_id, count in sorted(action_counts.items()):
        strategy_info = env.STRATEGIES[action_id]
        percentage = (count / total_actions) * 100
        print(f"Action {action_id} ({strategy_info['name']}): {count} times ({percentage:.1f}%)")
    
    # Find most and least used strategies
    most_common = action_counts.most_common(1)[0]
    least_common = action_counts.most_common()[-1]
    
    print(f"\nMost used strategy: {env.STRATEGIES[most_common[0]]['name']} ({most_common[1]} times)")
    print(f"Least used strategy: {env.STRATEGIES[least_common[0]]['name']} ({least_common[1]} times)")


if __name__ == "__main__":
    train_ppo_agent()