import { lazy } from 'react'
import config from '../../config/curriculum-guide.json'
import LearningGuideBoundary from '@/components/LearningGuideBoundary'
const Guide = lazy(() => import('./LearningGuide'))
const Legacy = lazy(() => import('./LegacyLearn'))
export default function Learn() { return config.enabled ? <LearningGuideBoundary><Guide /></LearningGuideBoundary> : <Legacy /> }
