import { ellipsify } from '@wallet-ui/react'
import { Button } from '@/components/ui/button'
import { ExplorerLink } from '@/components/cluster/cluster-ui'
import { useNftmarketplacedappProgramId, useGetProgramAccountQuery, useGreetMutation } from './nftmarketplacedapp-data-access'

export function NftmarketplacedappProgramExplorerLink() {
  const programId = useNftmarketplacedappProgramId()

  return <ExplorerLink address={programId.toString()} label={ellipsify(programId.toString())} />
}

export function NftmarketplacedappCreate() {
  const greetMutation = useGreetMutation()

  return (
    <Button onClick={() => greetMutation.mutateAsync()} disabled={greetMutation.isPending}>
      Run program{greetMutation.isPending && '...'}
    </Button>
  )
}

export function NftmarketplacedappProgram() {
  const query = useGetProgramAccountQuery()

  if (query.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }
  if (!query.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
      </div>
    )
  }
  return (
    <div className={'space-y-6'}>
      <pre>{JSON.stringify(query.data.value.data, null, 2)}</pre>
    </div>
  )
}
