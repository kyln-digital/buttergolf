import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Text,
  Alert,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

// ButterGolf brand colors
const brandColors = {
  spicedClementine: "#F45314",
  vanillaCream: "#FFFAD2",
  ironstone: "#323232",
  cloudMist: "#EDEDED",
  pureWhite: "#FFFFFF",
};

interface StripeConnectWebViewProps {
  /** The client secret from AccountSession */
  clientSecret: string;
  /** Stripe publishable key */
  publishableKey: string;
  /** Called when onboarding is completed successfully */
  onComplete: () => void;
  /** Called when user exits/cancels onboarding */
  onExit: () => void;
  /** Called when an error occurs */
  onError: (error: string) => void;
}

/**
 * StripeConnectWebView - Renders Stripe Connect embedded onboarding in a WebView.
 *
 * This component loads an HTML page that uses @stripe/connect-js to render
 * the AccountOnboarding embedded component. This gives a native-like experience
 * without needing to open an external browser.
 *
 * The WebView communicates with React Native via postMessage for:
 * - onboarding_complete: User finished onboarding
 * - onboarding_exit: User exited/cancelled
 * - onboarding_error: An error occurred
 */
export function StripeConnectWebView({
  clientSecret,
  publishableKey,
  onComplete,
  onExit,
  onError,
}: StripeConnectWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [webViewError, setWebViewError] = useState<string | null>(null);

  // HTML content that loads Stripe Connect.js and renders the onboarding component
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Seller Onboarding</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html, body {
      height: 100%;
      width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: ${brandColors.pureWhite};
      overflow-x: hidden;
    }
    
    #loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 16px;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid ${brandColors.cloudMist};
      border-top-color: ${brandColors.spicedClementine};
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .loading-text {
      color: ${brandColors.ironstone};
      font-size: 14px;
    }
    
    #error-container {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      padding: 24px;
      text-align: center;
      gap: 16px;
    }
    
    .error-icon {
      font-size: 48px;
    }
    
    .error-title {
      color: ${brandColors.ironstone};
      font-size: 18px;
      font-weight: 600;
    }
    
    .error-message {
      color: #666;
      font-size: 14px;
      max-width: 300px;
    }
    
    .retry-button {
      background-color: ${brandColors.spicedClementine};
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 24px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    
    #onboarding-container {
      display: none;
      min-height: 100vh;
      padding: 0;
    }
    
    /* Stripe component styling overrides */
    stripe-connect-account-onboarding {
      --accent-color: ${brandColors.spicedClementine};
      --button-primary-color: ${brandColors.spicedClementine};
    }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <div class="loading-text">Loading seller onboarding...</div>
  </div>
  
  <div id="error-container">
    <div class="error-icon">⚠️</div>
    <div class="error-title">Failed to load onboarding</div>
    <div class="error-message" id="error-message">An error occurred while loading the onboarding form.</div>
    <button class="retry-button" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type: 'onboarding_exit'}))">Go Back</button>
  </div>
  
  <div id="onboarding-container"></div>
  
  <script src="https://connect-js.stripe.com/v1.0/connect.js"></script>
  <script>
    (async function() {
      const publishableKey = "${publishableKey}";
      const clientSecret = "${clientSecret}";
      
      const loadingEl = document.getElementById('loading');
      const errorEl = document.getElementById('error-container');
      const errorMsgEl = document.getElementById('error-message');
      const containerEl = document.getElementById('onboarding-container');
      
      function showError(message) {
        loadingEl.style.display = 'none';
        containerEl.style.display = 'none';
        errorMsgEl.textContent = message;
        errorEl.style.display = 'flex';
        
        // Notify React Native
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'onboarding_error',
          error: message
        }));
      }
      
      function showOnboarding() {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'none';
        containerEl.style.display = 'block';
      }
      
      try {
        // Initialize Stripe Connect
        const stripeConnectInstance = await StripeConnect.init({
          publishableKey: publishableKey,
          clientSecret: clientSecret,
          appearance: {
            colors: {
              primary: "${brandColors.spicedClementine}",
              background: "${brandColors.pureWhite}",
            },
          },
        });
        
        // Create the account onboarding component
        const accountOnboarding = stripeConnectInstance.create('account-onboarding');
        
        // Handle onboarding exit (user clicked back/cancel or completed)
        accountOnboarding.setOnExit(() => {
          console.log('User exited onboarding');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'onboarding_exit'
          }));
        });
        
        // Handle step changes for analytics (optional)
        accountOnboarding.setOnStepChange((stepChange) => {
          console.log('Onboarding step:', stepChange.step);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'onboarding_step',
            step: stepChange.step
          }));
        });
        
        // Mount the component
        containerEl.appendChild(accountOnboarding);
        showOnboarding();
        
        // Notify React Native that we're ready
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'onboarding_ready'
        }));
        
      } catch (error) {
        console.error('Stripe Connect init error:', error);
        showError(error.message || 'Failed to initialize Stripe Connect');
      }
    })();
  </script>
</body>
</html>
`;

  // Handle messages from the WebView
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        console.log("[StripeConnectWebView] Message:", data);

        switch (data.type) {
          case "onboarding_ready":
            setIsLoading(false);
            break;

          case "onboarding_exit":
            // User exited - check if they completed or cancelled
            // We'll refresh status to determine completion
            onComplete();
            break;

          case "onboarding_error":
            setWebViewError(data.error);
            onError(data.error);
            break;

          case "onboarding_step":
            // Could track analytics here
            console.log("[StripeConnectWebView] Step:", data.step);
            break;

          default:
            console.log("[StripeConnectWebView] Unknown message type:", data.type);
        }
      } catch (error) {
        console.error("[StripeConnectWebView] Failed to parse message:", error);
      }
    },
    [onComplete, onError],
  );

  // Handle WebView errors
  const handleError = useCallback(
    (syntheticEvent: { nativeEvent: { description: string } }) => {
      const { description } = syntheticEvent.nativeEvent;
      console.error("[StripeConnectWebView] WebView error:", description);
      setWebViewError(description);
      onError(description);
    },
    [onError],
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with close button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onExit} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Seller</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* WebView container */}
      <View style={styles.webViewContainer}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={brandColors.spicedClementine} />
            <Text style={styles.loadingText}>Loading onboarding...</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webView}
          onMessage={handleMessage}
          onError={handleError}
          onHttpError={(syntheticEvent) => {
            console.error("[StripeConnectWebView] HTTP error:", syntheticEvent.nativeEvent);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={true}
          mixedContentMode="compatibility"
          originWhitelist={["*"]}
          // Security settings
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          // Allow Stripe's domain
          onShouldStartLoadWithRequest={(request) => {
            // Allow initial load and Stripe domains
            if (
              request.url.startsWith("about:") ||
              request.url.startsWith("data:") ||
              request.url.includes("stripe.com") ||
              request.url.includes("connect-js.stripe.com")
            ) {
              return true;
            }
            // Block other external navigation
            return false;
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.pureWhite,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.cloudMist,
    backgroundColor: brandColors.pureWhite,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 20,
    color: brandColors.ironstone,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: brandColors.ironstone,
  },
  headerSpacer: {
    width: 40,
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: brandColors.pureWhite,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: brandColors.pureWhite,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: brandColors.ironstone,
  },
});

export default StripeConnectWebView;
