import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	fontFamily: {
  		sans: [
  			'Instrument Sans',
  			'system-ui',
  			'sans-serif'
  		],
  		serif: [
  			'Space Grotesk',
  			'Georgia',
  			'serif'
  		]
  	},
  	extend: {
  		colors: {
  			foreground: 'hsl(var(--foreground))',
  			'background-start': 'rgb(var(--background-start-rgb))',
  			'background-end': 'rgb(var(--background-end-rgb))',
  			'brand-default': 'var(--brand-default)',
  			'brand-fainter': 'var(--brand-fainter)',
  			'brand-faint': 'var(--brand-faint)',
  			'brand-subtle': 'var(--brand-subtle)',
  			'brand-muted': 'var(--brand-muted)',
  			'brand-dark': 'var(--brand-dark)',
  			'brand-darker': 'var(--brand-darker)',
  			'secondary-accent': 'var(--secondary-accent)',
  			'secondary-accent2x': 'var(--secondary-accent2x)',
  			'secondary-dark': 'var(--secondary-dark)',
  			'secondary-darker': 'var(--secondary-darker)',
  			'secondary-darkest': 'var(--secondary-darkest)',
  			'secondary-default': 'var(--secondary-default)',
  			'secondary-faint': 'var(--secondary-faint)',
  			'secondary-fainter': 'var(--secondary-fainter)',
  			'gray-100': 'var(--gray-100)',
  			'gray-200': 'var(--gray-200)',
  			'gray-300': 'var(--gray-300)',
  			'gray-400': 'var(--gray-400)',
  			'gray-50': 'var(--gray-50)',
  			'gray-500': 'var(--gray-500)',
  			'gray-600': 'var(--gray-600)',
  			'gray-700': 'var(--gray-700)',
  			'gray-800': 'var(--gray-800)',
  			'gray-900': 'var(--gray-900)',
  			'gray-950': 'var(--gray-950)',
  			black: 'var(--black)',
  			white: 'var(--white)',
  			'accent-yellow-light': 'var(--accent-yellow-light)',
  			'accent-yellow-dark': 'var(--accent-yellow-dark)',
  			'accent-skyblue-light': 'var(--accent-skyblue-light)',
  			'accent-skyblue-dark': 'var(--accent-skyblue-dark)',
  			'accent-green': 'var(--accent-green)',
  			'accent-red': 'var(--accent-red)',
  			'accent-darkgreen-dark': 'var(--accent-darkgreen-dark)',
  			'accent-darkgreen-light': 'var(--accent-darkgreen-light)',
  			'accent-purple-dark': 'var(--accent-purple-dark)',
  			'accent-purple-light': 'var(--accent-purple-light)',
  			'accent-pink-dark': 'var(--accent-pink-dark)',
  			'accent-pink-light': 'var(--accent-pink-light)',
  			'accent-maroon-dark': 'var(--accent-maroon-dark)',
  			'accent-maroon-light': 'var(--accent-maroon-light)',
  			'dark-accent-skyblue-dark': 'var(--dark-accent-skyblue-dark)',
  			'dark-accent-skyblue-light': 'var(--dark-accent-skyblue-light)',
  			'dark-accent-maroon-dark': 'var(--dark-accent-maroon-dark)',
  			'dark-accent-maroon-light': 'var(--dark-accent-maroon-light)',
  			'dark-accent-green-dark': 'var(--dark-accent-green-dark)',
  			'dark-accent-green-light': 'var(--dark-accent-green-light)',
  			'dark-accent-yellow-dark': 'var(--dark-accent-yellow-dark)',
  			'dark-accent-yellow-light': 'var(--dark-accent-yellow-light)',
  			'dark-accent-purple-dark': 'var(--dark-accent-purple-dark)',
  			'dark-accent-purple-light': 'var(--dark-accent-purple-light)',
  			'dark-accent-pink-dark': 'var(--dark-accent-pink-dark)',
  			'dark-accent-pink-light': 'var(--dark-accent-pink-light)',
  			background: 'hsl(var(--background))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		animation: {
  			'fade-up': 'fade-up 0.5s ease-out forwards'
  		},
  		keyframes: {
  			'fade-up': {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(20px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			}
  		},
  		borderRadius: {
  			DEFAULT: 'var(--border-radius-default)',
  			lg: 'var(--border-radius-default)',
  			md: 'calc(var(--border-radius-default) - 2px)',
  			sm: 'calc(var(--border-radius-default) - 4px)'
  		},
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
  		}
  	},
  	keyframes: {
  		typing: {
  			'0%, 100%': {
  				transform: 'translateY(0)',
  				opacity: '0.5'
  			},
  			'50%': {
  				transform: 'translateY(-2px)',
  				opacity: '1'
  			}
  		},
  		'loading-dots': {
  			'0%, 100%': {
  				opacity: '0'
  			},
  			'50%': {
  				opacity: '1'
  			}
  		},
  		wave: {
  			'0%, 100%': {
  				transform: 'scaleY(1)'
  			},
  			'50%': {
  				transform: 'scaleY(0.6)'
  			}
  		},
  		blink: {
  			'0%, 100%': {
  				opacity: '1'
  			},
  			'50%': {
  				opacity: '0'
  			}
  		},
  		shimmer: {
  			'0%': {
  				backgroundPosition: '200% 50%'
  			},
  			'100%': {
  				backgroundPosition: '-200% 50%'
  			}
  		}
  	},
  	'text-blink': {
  		'0%, 100%': {
  			color: 'var(--primary)'
  		},
  		'50%': {
  			color: 'var(--muted-foreground)'
  		}
  	},
  	'bounce-dots': {
  		'0%, 100%': {
  			transform: 'scale(0.8)',
  			opacity: '0.5'
  		},
  		'50%': {
  			transform: 'scale(1.2)',
  			opacity: '1'
  		}
  	},
  	'thin-pulse': {
  		'0%, 100%': {
  			transform: 'scale(0.95)',
  			opacity: '0.8'
  		},
  		'50%': {
  			transform: 'scale(1.05)',
  			opacity: '0.4'
  		}
  	},
  	'pulse-dot': {
  		'0%, 100%': {
  			transform: 'scale(1)',
  			opacity: '0.8'
  		},
  		'50%': {
  			transform: 'scale(1.5)',
  			opacity: '1'
  		}
  	},
  	'shimmer-text': {
  		'0%': {
  			backgroundPosition: '150% center'
  		},
  		'100%': {
  			backgroundPosition: '-150% center'
  		}
  	},
  	'wave-bars': {
  		'0%, 100%': {
  			transform: 'scaleY(1)',
  			opacity: '0.5'
  		},
  		'50%': {
  			transform: 'scaleY(0.6)',
  			opacity: '1'
  		}
  	},
  	shimmer: {
  		'0%': {
  			backgroundPosition: '200% 50%'
  		},
  		'100%': {
  			backgroundPosition: '-200% 50%'
  		}
  	},
  	'spinner-fade': {
  		'0%': {
  			opacity: '0'
  		},
  		'100%': {
  			opacity: '1'
  		}
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    require('@tailwindcss/typography'),
  ],
};
export default config;